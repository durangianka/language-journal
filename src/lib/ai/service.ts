import { InvalidFeedback, validateFeedback, type FeedbackOutput } from "./schema";
import {
  ProviderError,
  type AnalysisInput,
  type CallKind,
  type FeedbackProvider,
  type GenerateOptions,
} from "./provider";
import type { FeedbackReason } from "../feedback-contract";

export type FeedbackJob = {
  id: string;
  entryId: string;
  journalId: string;
  callId: string;
  input: AnalysisInput;
};
export type CallLog = {
  outcome: "ready" | "failed";
  reasonCode: FeedbackReason | null;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
};
export interface FeedbackStore {
  claim(callId: string): Promise<boolean>;
  reserve(job: FeedbackJob, kind: CallKind): Promise<string | null>;
  log(callId: string, log: CallLog): Promise<void>;
  ready(job: FeedbackJob, output: FeedbackOutput): Promise<void>;
  failed(id: string, reason: FeedbackReason): Promise<void>;
}

export const timeoutMs = 20_000;

async function timedGenerate(
  provider: FeedbackProvider,
  input: AnalysisInput,
  options: GenerateOptions,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      provider.generate(input, controller.signal, options),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new ProviderError("timeout"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// At most three metered calls: initial, one SDK retry, and one validation repair.
export async function runFeedback(
  job: FeedbackJob,
  store: FeedbackStore,
  provider: FeedbackProvider,
) {
  let callId = job.callId;
  let input = job.input;
  let retried = false;
  let repaired = false;
  try {
    while (true) {
      if (!(await store.claim(callId))) return;
      let start = Date.now();
      let retryBlocked = false;
      let usage: { inputTokens: number | null; outputTokens: number | null } = {
        inputTokens: null,
        outputTokens: null,
      };
      let output: FeedbackOutput | undefined;
      let reason: FeedbackReason | undefined;
      let next: CallKind | undefined;
      try {
        const result = await timedGenerate(provider, input, {
          maxRetries: retried ? 0 : 1,
          async beforeRetry() {
            await store.log(callId, {
              inputTokens: null,
              outputTokens: null,
              outcome: "failed",
              reasonCode: "provider_error",
              durationMs: Date.now() - start,
            });
            const reserved = await store.reserve(job, "retry");
            if (!reserved) {
              retryBlocked = true;
              throw new ProviderError("daily_cap_reached");
            }
            callId = reserved;
            start = Date.now();
            if (!(await store.claim(callId))) {
              retryBlocked = true;
              throw new ProviderError("provider_error");
            }
            retried = true;
          },
        });
        usage = { inputTokens: result.inputTokens, outputTokens: result.outputTokens };
        try {
          output = validateFeedback(result.text, input.analysedText, input.locale);
        } catch (error) {
          if (!(error instanceof InvalidFeedback)) throw error;
          reason = "invalid_output";
          if (!repaired) {
            repaired = true;
            next = "repair";
            input = {
              ...job.input,
              repair: { output: result.text, reason: result.validationError ?? error.reason },
            };
          }
        }
      } catch (error) {
        if (retryBlocked) {
          await store.failed(
            job.id,
            error instanceof ProviderError && error.reason === "daily_cap_reached"
              ? "daily_cap_reached"
              : "provider_error",
          );
          return;
        }
        reason =
          error instanceof ProviderError && error.reason === "timeout"
            ? "timeout"
            : "provider_error";
      }
      await store.log(callId, {
        ...usage,
        outcome: output ? "ready" : "failed",
        reasonCode: reason ?? null,
        durationMs: Date.now() - start,
      });
      if (output) {
        await store.ready(job, output);
        return;
      }
      if (!next) {
        await store.failed(job.id, reason ?? "invalid_output");
        return;
      }
      const reserved = await store.reserve(job, next);
      if (!reserved) {
        await store.failed(job.id, "daily_cap_reached");
        return;
      }
      callId = reserved;
    }
  } catch {
    // Never leak model output, entry text or provider error bodies into logs.
    await store.failed(job.id, "provider_error");
  }
}
