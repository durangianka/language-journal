import "server-only";
import { createOpenAI, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import {
  generateText,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  RetryError,
  wrapLanguageModel,
} from "ai";
import { feedbackPrompt } from "./prompt";
import { model, ProviderError, type FeedbackProvider } from "./provider";
import { feedbackOutputSchema } from "./schema";

// Model injection exercises the real SDK, including validation and retries, without HTTP.
export function createFeedbackProvider(
  languageModel: Parameters<typeof wrapLanguageModel>[0]["model"],
): FeedbackProvider {
  return {
    async generate(input, signal, options) {
      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
      let attempted = false;
      const meteredModel = wrapLanguageModel({
        model: languageModel,
        middleware: {
          specificationVersion: "v4",
          async wrapGenerate({ doGenerate }) {
            abortSignal.throwIfAborted();
            if (attempted) await options?.beforeRetry();
            abortSignal.throwIfAborted();
            attempted = true;
            return doGenerate();
          },
        },
      });
      const prompt = feedbackPrompt(input);
      try {
        const result = await generateText({
          model: meteredModel,
          output: Output.object({ schema: feedbackOutputSchema, name: "journal_feedback" }),
          system: prompt.instructions,
          prompt: prompt.input,
          providerOptions: {
            openai: {
              store: false,
              strictJsonSchema: true,
            } satisfies OpenAILanguageModelResponsesOptions,
          },
          maxRetries: options?.maxRetries ?? 1,
          abortSignal,
        });
        return {
          // Access output so SDK schema validation cannot be bypassed.
          text: result.finishReason === "stop" ? JSON.stringify(result.output) : "",
          inputTokens: result.usage.inputTokens ?? null,
          outputTokens: result.usage.outputTokens ?? null,
        };
      } catch (error) {
        if (abortSignal.aborted) throw new ProviderError("timeout");
        if (NoObjectGeneratedError.isInstance(error)) {
          return {
            text: error.text ?? "",
            inputTokens: error.usage?.inputTokens ?? null,
            outputTokens: error.usage?.outputTokens ?? null,
            validationError: error.cause instanceof Error ? error.cause.message : error.message,
          };
        }
        if (NoOutputGeneratedError.isInstance(error)) {
          return { text: "", inputTokens: null, outputTokens: null };
        }
        const cause = RetryError.isInstance(error) ? error.lastError : error;
        if (cause instanceof ProviderError) throw cause;
        throw new ProviderError("provider_error");
      }
    },
  };
}

export const openAIProvider: FeedbackProvider = {
  async generate(input, signal, options) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ProviderError("missing_api_key");
    const openai = createOpenAI({ apiKey });
    return createFeedbackProvider(openai.responses(model)).generate(input, signal, options);
  },
};
