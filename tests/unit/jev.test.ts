import { afterEach, expect, test, vi } from "vitest";
import { judgeEntry as judgeEntryInLanguage, jevTimeoutMs, type JevStore } from "../../src/lib/jev/service";

// Every live check runs in the journal language, so the tests pass Spanish throughout.
const judgeEntry = (
  text: string,
  entryId: string | null,
  client: Parameters<typeof judgeEntryInLanguage>[2],
  store: JevStore,
) => judgeEntryInLanguage(text, entryId, client, store, "es");

const text = "Yesterday I goes to the local market to buy some fresh fruit.";
function result(choice = "grammar", confidence = 0.95, kind = "standard_language") {
  return {
    text_kind: {
      type: "choice",
      choice: kind,
      confidence: 0.9,
      probabilities: Object.fromEntries(
        ["standard_language", "informal_language", "mixed", "formula_or_numbers", "encoded", "random", "other_language"].map(
          (key) => [key, key === kind ? 0.9 : 0.014],
        ),
      ),
    },
    main_issue: {
      type: "choice",
      choice,
      confidence,
      probabilities: { grammar: 0.95, vocabulary: 0.01, spelling: 0.01, style: 0.01, none: 0.02 },
    },
    severity: {
      type: "score",
      score: 1.3,
      confidence: 0.9,
      legend: { "0": "minor", "1": "moderate", "2": "major" },
      probabilities: { "0": 0, "1": 0.7, "2": 0.3 },
    },
  };
}
function store(): JevStore {
  return { reserve: vi.fn(async () => "call"), finish: vi.fn(async () => {}) };
}
afterEach(() => vi.useRealTimers());

test("formula text is reported as not language, never as no issues", async () => {
  const log = store();
  expect(await judgeEntry("2 + 2 = 4; 3 * 3 = 9", null, { judge: async () => result("none", 0.95, "formula_or_numbers") }, log)).toEqual({
    issue: "not_language",
    confidence: 0.9,
  });
});

test("none at the confidence threshold produces the fixed no-issues note", async () => {
  const log = store();
  expect(await judgeEntry(text, null, { judge: async () => result("none", 0.5) }, log)).toEqual({
    issue: "none",
    confidence: 0.5,
  });
  expect(log.finish).toHaveBeenCalledWith("call", expect.any(Object), expect.any(Number));
});
test("a confident category result contains only a label and confidence", async () => {
  expect(await judgeEntry(text, null, { judge: async () => result() }, store())).toEqual({
    issue: "grammar",
    confidence: 0.95,
  });
});
test("short entries stay hidden", async () => {
  const client = { judge: vi.fn(async () => result()) };
  expect(await judgeEntry("Short", null, client, store())).toBeNull();
  expect(client.judge).not.toHaveBeenCalled();
});

test.each([0.1, 0.4, 0.499, 0.5, 0.84])(
  "confidence %f shows a category or uncertainty",
  async (confidence) => {
    expect(
      await judgeEntry(text, null, { judge: async () => result("spelling", confidence) }, store()),
    ).toEqual({
      issue: confidence >= 0.5 ? "spelling" : "uncertain",
      confidence,
    });
  },
);

test.each([7, 8])("%i characters respect the blur check threshold", async (length) => {
  const client = { judge: vi.fn(async () => result()) };
  const log = store();
  const note = await judgeEntry("a".repeat(length), null, client, log);
  expect(client.judge).toHaveBeenCalledTimes(length === 8 ? 1 : 0);
  expect(log.reserve).toHaveBeenCalledTimes(length === 8 ? 1 : 0);
  expect(note).toEqual(length === 8 ? { issue: "grammar", confidence: 0.95 } : null);
});
test("timeout aborts the client, logs the failed call and shows nothing", async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  const log = store();
  const job = judgeEntry(
    text,
    null,
    {
      judge: async (_text, s) => {
        signal = s;
        return new Promise(() => {});
      },
    },
    log,
  );
  await vi.advanceTimersByTimeAsync(jevTimeoutMs);
  expect(await job).toBeNull();
  expect(signal?.aborted).toBe(true);
  expect(log.finish).toHaveBeenCalledWith("call", null, jevTimeoutMs);
});
test("daily cap refuses before any provider call", async () => {
  const client = { judge: vi.fn() };
  expect(
    await judgeEntry(text, null, client, { ...store(), reserve: async () => null }),
  ).toBeNull();
  expect(client.judge).not.toHaveBeenCalled();
});

test("provider failure is logged server-side and still finishes the call log", async () => {
  const error = new Error("PRIVATE_PROVIDER_SENTINEL");
  const logger = vi.spyOn(console, "error").mockImplementation(() => {});
  const log = store();
  const client = { judge: vi.fn().mockRejectedValue(error) };
  expect(await judgeEntry(text, null, client, log)).toBeNull();
  expect(logger).toHaveBeenCalledWith("jev_check_failed", { status: 500 });
  expect(JSON.stringify(logger.mock.calls)).not.toContain(error.message);
  expect(log.finish).toHaveBeenCalledWith("call", null, expect.any(Number));
});

test("call-log failures never log private error details", async () => {
  const logger = vi.spyOn(console, "error").mockImplementation(() => {});
  const log = {
    ...store(),
    finish: vi.fn().mockRejectedValue(new Error("PRIVATE_STORE_SENTINEL")),
  };
  expect(await judgeEntry(text, null, { judge: async () => result() }, log)).not.toBeNull();
  expect(logger).toHaveBeenCalledWith("jev_call_log_failed", { status: 500 });
  expect(JSON.stringify(logger.mock.calls)).not.toContain("PRIVATE_STORE_SENTINEL");
});
test("Jev cannot write explanations or corrected text into its note or log", async () => {
  const raw = { ...result(), explanation: "Untrusted prose", corrected_text: "Do this" };
  const log = store();
  const note = await judgeEntry(text, null, { judge: async () => raw }, log);
  expect(JSON.stringify(note)).not.toContain("Untrusted");
  expect(log.finish).toHaveBeenCalledWith("call", result(), expect.any(Number));
});
