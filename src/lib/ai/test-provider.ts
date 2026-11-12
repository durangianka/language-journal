import "server-only";
import { ProviderError, type FeedbackProvider } from "./provider";

// Browser tests exercise the real actions, queue and persistence without a network model.
export const testFeedbackProvider: FeedbackProvider = {
  async generate(input) {
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
    return {
      text: JSON.stringify({
        corrected_text: input.analysedText.replace(example.original, example.fix),
        corrections: input.analysedText.includes(example.original)
          ? [{ ...example, category: "grammar", explanation: explanations[input.locale] }]
          : [],
      }),
      inputTokens: 0,
      outputTokens: 0,
    };
  },
};
