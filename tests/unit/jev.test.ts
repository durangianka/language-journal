import { afterEach, expect, test, vi } from "vitest";
import { judgeEntry, jevTimeoutMs, type JevStore } from "../../src/lib/jev/service";

const text = "Yesterday I goes to the local market to buy some fresh fruit.";
function result(choice = "grammar", confidence = 0.95) {
  return {
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

test("none at the confidence threshold produces the fixed no-issues note", async () => {
  const log = store();
  expect(await judgeEntry(text, null, { judge: async () => result("none", 0.85) }, log)).toEqual({
    issue: "none",
    confidence: 0.85,
  });
  expect(log.finish).toHaveBeenCalledWith("call", expect.any(Object), expect.any(Number));
});
test("a confident category result contains only a label and confidence", async () => {
  expect(await judgeEntry(text, null, { judge: async () => result() }, store())).toEqual({
    issue: "grammar",
    confidence: 0.95,
  });
});
test("low confidence and short entries stay hidden", async () => {
  const client = { judge: vi.fn(async () => result("grammar", 0.84)) };
  expect(await judgeEntry(text, null, client, store())).toBeNull();
  expect(await judgeEntry("Short entry", null, client, store())).toBeNull();
  expect(client.judge).toHaveBeenCalledTimes(1);
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
test("Jev cannot write explanations or corrected text into its note or log", async () => {
  const raw = { ...result(), explanation: "Untrusted prose", corrected_text: "Do this" };
  const log = store();
  const note = await judgeEntry(text, null, { judge: async () => raw }, log);
  expect(JSON.stringify(note)).not.toContain("Untrusted");
  expect(log.finish).toHaveBeenCalledWith("call", result(), expect.any(Number));
});
