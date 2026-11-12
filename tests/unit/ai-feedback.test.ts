import { afterEach, expect, test, vi } from "vitest";
import { validateFeedback } from "../../src/lib/ai/schema";
import { requestLimit } from "../../src/lib/ai/limits";
import { ProviderError, type FeedbackProvider } from "../../src/lib/ai/provider";
import { runFeedback, type FeedbackJob, type FeedbackStore } from "../../src/lib/ai/service";
import { feedbackPrompt, promptVersion } from "../../src/lib/ai/prompt";

const good = {
  corrected_text: "I went home.",
  corrections: [
    {
      original: "goed",
      fix: "went",
      category: "grammar",
      explanation: "Use the irregular past tense when describing a finished action.",
    },
  ],
};
const job: FeedbackJob = {
  id: "feedback",
  entryId: "entry",
  journalId: "journal",
  callId: "call",
  input: {
    analysedText: "I goed home.",
    language: "en",
    level: "basic",
    focus: ["grammar"],
    locale: "en",
  },
};
const result = (text = JSON.stringify(good)) => ({ text, inputTokens: 12, outputTokens: 34 });
function fixture() {
  const store = {
    claim: vi.fn().mockResolvedValue(true),
    reserve: vi.fn().mockResolvedValue("extra"),
    log: vi.fn(),
    ready: vi.fn(),
    failed: vi.fn(),
  } satisfies FeedbackStore;
  const provider = { generate: vi.fn().mockResolvedValue(result()) } satisfies FeedbackProvider;
  return { store, provider };
}
afterEach(() => vi.useRealTimers());

test("strict validation accepts exact repeated spans and zero corrections", () => {
  expect(validateFeedback(JSON.stringify(good), "goed goed", "en")).toEqual(good);
  expect(
    validateFeedback(
      JSON.stringify({ corrected_text: "😀".repeat(2000), corrections: [] }),
      "Hi",
      "en",
    ).corrections,
  ).toEqual([]);
});
test.each([
  ["invalid_json", "{"],
  ["invalid_schema", JSON.stringify({ ...good, extra: true })],
  ["invalid_schema", JSON.stringify({ ...good, corrected_text: "a".repeat(2001) })],
  ["invalid_schema", JSON.stringify({ ...good, corrections: Array(4).fill(good.corrections[0]) })],
  [
    "invalid_schema",
    JSON.stringify({ ...good, corrections: [{ ...good.corrections[0], category: "gramática" }] }),
  ],
  [
    "invalid_schema",
    JSON.stringify({ ...good, corrections: [{ ...good.corrections[0], original: "" }] }),
  ],
  [
    "invalid_schema",
    JSON.stringify({
      ...good,
      corrections: [{ ...good.corrections[0], explanation: "a".repeat(201) }],
    }),
  ],
  [
    "invalid_schema",
    JSON.stringify({
      ...good,
      corrections: [{ ...good.corrections[0], explanation: "Two\nlines" }],
    }),
  ],
  [
    "invalid_span",
    JSON.stringify({ ...good, corrections: [{ ...good.corrections[0], original: "Goed" }] }),
  ],
  [
    "invalid_span",
    JSON.stringify({ ...good, corrections: [{ ...good.corrections[0], original: "goed  home" }] }),
  ],
  [
    "wrong_locale",
    JSON.stringify({
      ...good,
      corrections: [
        {
          ...good.corrections[0],
          explanation: "Usa el pasado para describir una acción que ya terminó.",
        },
      ],
    }),
  ],
])("rejects %s", (reason, output) => {
  expect(() => validateFeedback(output, job.input.analysedText, "en")).toThrow(reason);
});

test.each([
  ["en", "Use the irregular past tense when describing a finished action."],
  ["es", "Usa el pasado para describir una acción que ya terminó."],
  ["it", "Usa il passato per descrivere una azione che è già terminata."],
] as const)("accepts explanation locale %s", (locale, explanation) => {
  expect(
    validateFeedback(
      JSON.stringify({ ...good, corrections: [{ ...good.corrections[0], explanation }] }),
      job.input.analysedText,
      locale,
    ),
  ).toBeDefined();
});
test("limits allow the third request and fiftieth call, refuse the next", () => {
  expect(requestLimit(2, 49)).toBeNull();
  expect(requestLimit(3, 0)).toBe("entry_limit_reached");
  expect(requestLimit(0, 50)).toBe("daily_cap_reached");
});
test("versioned prompt uses locale, target language, level and focus without following entry instructions", () => {
  const prompt = feedbackPrompt({ ...job.input, locale: "it", language: "es" });
  expect(promptVersion).toBeTruthy();
  expect(prompt.instructions).toContain("locale it");
  expect(prompt.instructions).toContain("language is es");
  expect(prompt.instructions).toContain("level basic");
  expect(JSON.parse(prompt.input).focus).toEqual(["grammar"]);
});
test("pending transitions to ready and logs tokens without model text", async () => {
  const { store, provider } = fixture();
  await runFeedback(job, store, provider);
  expect(store.ready).toHaveBeenCalledWith(job, good);
  expect(store.failed).not.toHaveBeenCalled();
  expect(store.log).toHaveBeenCalledWith("call", {
    outcome: "ready",
    reasonCode: null,
    durationMs: expect.any(Number),
    inputTokens: 12,
    outputTokens: 34,
  });
});

test.each(["new", "basic", "intermediate", "advanced"] as const)(
  "%s shorthand feedback uses the learner's level and preserves mixed meaning",
  (level) => {
    const prompt = feedbackPrompt({
      ...job.input,
      level,
      analysedText: "tbh I studied A = 2 + B today.",
    });
    expect(prompt.instructions).toContain(`level ${level}`);
    expect(prompt.instructions).toContain(
      "Preserve the meaning of sentences containing formulas or numbers.",
    );
    expect(JSON.parse(prompt.input).entry).toBe("tbh I studied A = 2 + B today.");
    if (level === "advanced") {
      expect(prompt.instructions).toContain("flag informal shorthand as a style correction");
      expect(prompt.instructions).not.toContain("For this New or Basic learner");
    } else if (level === "new" || level === "basic") {
      expect(prompt.instructions).toContain("gently show the standard form");
      expect(prompt.instructions).not.toContain("flag informal shorthand as a style correction");
    }
  },
);
test("invalid output gets exactly one repair and keeps the original snapshot", async () => {
  const { store, provider } = fixture();
  provider.generate.mockResolvedValueOnce(result("{}"));
  await runFeedback(job, store, provider);
  expect(store.reserve).toHaveBeenCalledWith(job, "repair");
  expect(provider.generate).toHaveBeenCalledTimes(2);
  expect(provider.generate.mock.calls[1][0]).toMatchObject({
    analysedText: job.input.analysedText,
    repair: { output: "{}", reason: "invalid_schema" },
  });
  expect(store.ready).toHaveBeenCalledOnce();
});
test("invalid repair transitions to failed", async () => {
  const { store, provider } = fixture();
  provider.generate.mockResolvedValue(result("{}"));
  await runFeedback(job, store, provider);
  expect(provider.generate).toHaveBeenCalledTimes(2);
  expect(store.failed).toHaveBeenCalledWith(job.id, "invalid_output");
  expect(store.ready).not.toHaveBeenCalled();
});
test.each(["http_400", "http_401", "http_429", "timeout", "missing_api_key"])(
  "does not retry %s",
  async (reason) => {
    const { store, provider } = fixture();
    provider.generate.mockRejectedValue(new ProviderError(reason));
    await runFeedback(job, store, provider);
    expect(store.reserve).not.toHaveBeenCalled();
    expect(provider.generate).toHaveBeenCalledOnce();
    expect(store.failed).toHaveBeenCalledWith(
      job.id,
      reason === "timeout" ? "timeout" : "provider_error",
    );
  },
);
test("daily cap refuses repair without making another call", async () => {
  const { store, provider } = fixture();
  store.reserve.mockResolvedValue(null);
  provider.generate.mockResolvedValue(result("{}"));
  await runFeedback(job, store, provider);
  expect(provider.generate).toHaveBeenCalledOnce();
  expect(store.failed).toHaveBeenCalledWith(job.id, "daily_cap_reached");
});
test("20 second timeout aborts even a provider that never resolves", async () => {
  vi.useFakeTimers();
  const { store, provider } = fixture();
  provider.generate.mockImplementation(() => new Promise(() => {}));
  const running = runFeedback(job, store, provider);
  await vi.advanceTimersByTimeAsync(20_000);
  await running;
  expect(provider.generate.mock.calls[0][1].aborted).toBe(true);
  expect(store.failed).toHaveBeenCalledWith(job.id, "timeout");
  expect(store.reserve).not.toHaveBeenCalled();
});
test("duplicate delivery does not invoke a model", async () => {
  const { store, provider } = fixture();
  store.claim.mockResolvedValue(false);
  await runFeedback(job, store, provider);
  expect(provider.generate).not.toHaveBeenCalled();
});
