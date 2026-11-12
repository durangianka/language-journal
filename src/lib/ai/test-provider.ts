import "server-only";
import { MockLanguageModelV4 } from "ai/test";
import { ProviderError, type FeedbackProvider } from "./provider";
import { createFeedbackProvider } from "./sdk";

// Browser tests exercise the real actions, queue and persistence without a network model.
export const testFeedbackProvider: FeedbackProvider = {
  async generate(input, signal, options) {
    const database = new URL(process.env.DATABASE_URL ?? "").pathname;
    if (process.env.FEEDBACK_TEST_MODE !== "1" || !database.endsWith("_test"))
      throw new ProviderError("test_provider_requires_test_database");
    const examples = {
      en: { original: "I goes", fix: "I go" },
      es: { original: "Yo va", fix: "Yo voy" },
      it: { original: "Io va", fix: "Io vado" },
    };
    const explanations = {
      en: "Use the present tense when describing a regular daily action.",
      es: "Usa el presente para describir una acción que se repite todos los días.",
      it: "Usa il tempo presente per descrivere un'azione che si ripete ogni giorno.",
    };
    const example = examples[input.language];
    const text = JSON.stringify({
      corrected_text: input.analysedText.replace(example.original, example.fix),
      corrections: input.analysedText.includes(example.original)
        ? [{ ...example, category: "grammar", explanation: explanations[input.locale] }]
        : [],
    });
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 0, text: 0, reasoning: undefined },
        },
        warnings: [],
      }),
    });
    return createFeedbackProvider(model).generate(input, signal, options);
  },
};
