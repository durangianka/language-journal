import { expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { openAIProvider } from "../../src/lib/ai/sdk";
import { validateFeedback } from "../../src/lib/ai/schema";

test.skipIf(process.env.RUN_LIVE_AI !== "1")(
  "live English and Spanish feedback, exactly two calls",
  async () => {
    // Explicit opt-in only. No database imports, persistence, retries or repairs.
    for (const [locale, analysedText] of [
      ["en", "Yesterday I goed to the shop."],
      ["es", "Ayer yo ir al mercado."],
    ] as const) {
      const result = await openAIProvider.generate(
        { analysedText, language: locale, locale, level: "basic", focus: ["grammar"] },
        AbortSignal.timeout(20_000),
        { maxRetries: 0, beforeRetry: async () => {} },
      );
      expect(validateFeedback(result.text, analysedText, locale)).toBeDefined();
    }
  },
  45_000,
);
