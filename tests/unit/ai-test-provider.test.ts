import { afterEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { testFeedbackProvider } from "../../src/lib/ai/test-provider";
import { validateFeedback } from "../../src/lib/ai/schema";

afterEach(() => vi.unstubAllEnvs());
const input = {
  analysedText: "I goes to school.",
  language: "en" as const,
  level: "basic" as const,
  focus: [],
  locale: "en" as const,
};
test.each(["en", "es", "it"] as const)(
  "fake model produces valid %s feedback without fetch",
  async (locale) => {
    vi.stubEnv("FEEDBACK_TEST_MODE", "1");
    vi.stubEnv("DATABASE_URL", "postgres://localhost/journal_test");
    const result = await testFeedbackProvider.generate(
      { ...input, locale },
      new AbortController().signal,
    );
    expect(validateFeedback(result.text, input.analysedText, locale)).toMatchObject({
      corrected_text: "I go to school.",
    });
  },
);
test.each([
  ["1", "postgres://localhost/journal"],
  ["0", "postgres://localhost/journal_test"],
])("fake model rejects mode %s with database %s", async (mode, url) => {
  vi.stubEnv("FEEDBACK_TEST_MODE", mode);
  vi.stubEnv("DATABASE_URL", url);
  await expect(testFeedbackProvider.generate(input, new AbortController().signal)).rejects.toThrow(
    "test_provider_requires_test_database",
  );
});
