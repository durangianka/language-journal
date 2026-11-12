import { InvalidFeedback, validateFeedback, type FeedbackOutput } from "./schema";
import {
  ProviderError,
  type AnalysisInput,
  type CallKind,
  type FeedbackProvider,
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

async function timedGenerate(provider: FeedbackProvider, input: AnalysisInput) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      provider.generate(input, controller.signal),
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

// At most three calls: initial, one network/5xx retry, and one validation repair.
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
      const start = Date.now();
      let usage: { inputTokens: number | null; outputTokens: number | null } = {
        inputTokens: null,
        outputTokens: null,
      };
      let output: FeedbackOutput | undefined;
      let reason: FeedbackReason | undefined;
      let next: CallKind | undefined;
      try {
        const result = await timedGenerate(provider, input);
        usage = { inputTokens: result.inputTokens, outputTokens: result.outputTokens };
        try {
          output = validateFeedback(result.text, input.analysedText, input.locale);
        } catch (error) {
          if (!(error instanceof InvalidFeedback)) throw error;
          reason = "invalid_output";
          if (!repaired) {
            repaired = true;
            next = "repair";
            input = { ...job.input, repair: { output: result.text, reason: error.reason } };
          }
        }
      } catch (error) {
        reason =
          error instanceof ProviderError && error.reason === "timeout"
            ? "timeout"
            : "provider_error";
        if (error instanceof ProviderError && error.retryable && !retried) {
          retried = true;
          next = "retry";
        }
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
