import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  deleteEntry,
  deleteJournal,
  getEntry,
  listEntries,
  parseStubState,
  requestFeedback,
  seedEntries,
  STUB_STORAGE_KEY,
  visibleEntries,
} from "../../src/lib/feedback-client";
import type { EntryDto, Locale } from "../../src/lib/feedback-contract";

const storage = new Map<string, string>();
let sequence = 0;
function seed(body = "I goes to school.", language: Locale = "en") {
  const entry: EntryDto = {
    id: `entry-${++sequence}`,
    journalId: `journal-${sequence}`,
    body,
    entryDate: "2026-11-10",
    createdAt: "2026-11-10T12:00:00.000Z",
    updatedAt: "2026-11-10T12:00:00.000Z",
    latestFeedback: null,
  };
  seedEntries([entry], language);
  return entry;
}
beforeEach(() => {
  storage.clear();
  const target = new EventTarget();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    dispatchEvent: target.dispatchEvent.bind(target),
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  });
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

test("malformed and outdated stored state cannot break the review screen", () => {
  const entry = seed();
  for (const raw of ["", "not json", "null", '{"feedback": {"id": {"createdAt": "invalid"}}}']) {
    expect(visibleEntries([entry], parseStubState(raw))).toEqual([entry]);
  }
});

test.each<Locale>(["en", "es", "it"])(
  "sample feedback explanations use %s and preserve original writing",
  async (locale) => {
    const entry = seed();
    const pending = requestFeedback(entry.id, locale);
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Sample request failed");
    expect(result.data.correctedText).toBe("I go to school.");
    expect(result.data.locale).toBe(locale);
    expect(result.data.corrections).toHaveLength(1);
    expect((await getEntry(entry.id))?.body).toBe(entry.body);
    expect((await getEntry(entry.id))?.latestFeedback).toEqual(result.data);
  },
);

test("sample corrections use the journal language and allow zero corrections", async () => {
  for (const [body, language, expected] of [
    ["Yo va al parque.", "es", "Yo voy al parque."],
    ["Io va al parco.", "it", "Io vado al parco."],
  ]) {
    if (language !== "es" && language !== "it") throw new Error("Invalid test language");
    const entry = seed(body, language);
    const pending = requestFeedback(entry.id, "en");
    await vi.runAllTimersAsync();
    const result = await pending;
    if (!result.success) throw new Error("Sample request failed");
    expect(result.data.correctedText).toBe(expected);
  }
  const entry = seed("Today I read a story.");
  const pending = requestFeedback(entry.id, "en");
  await vi.runAllTimersAsync();
  const result = await pending;
  if (!result.success) throw new Error("Sample request failed");
  expect(result.data.corrections).toEqual([]);
  expect(result.data.correctedText).toBe(entry.body);
});

test("feedback length limits count Unicode code points", async () => {
  for (const length of [2000, 2001]) {
    const entry = seed("😀".repeat(length));
    const pending = requestFeedback(entry.id, "en");
    await vi.runAllTimersAsync();
    const result = await pending;
    if (!result.success) throw new Error("Sample request failed");
    expect(result.data.reason).toBe(length === 2001 ? "too_long" : null);
    expect(result.data.status).toBe(length === 2001 ? "failed" : "ready");
  }
});

test.each(["soft", "hard"])(
  "%s entry deletion removes it from get and list without affecting another journal",
  async (mode) => {
    if (mode !== "soft" && mode !== "hard") throw new Error("Invalid test mode");
    const entry = seed();
    const other = seed();
    expect(await deleteEntry(entry.id, mode)).toEqual({ success: true, data: null });
    expect(await listEntries(entry.journalId)).toEqual([]);
    expect(await getEntry(entry.id)).toBeNull();
    expect(await getEntry(other.id)).toEqual(other);
  },
);

test("journal hard deletion hides all its entries and removes their sample feedback", async () => {
  const entry = seed();
  const pending = requestFeedback(entry.id, "en");
  await vi.runAllTimersAsync();
  await pending;
  await deleteJournal(entry.journalId, "hard");
  expect(await listEntries(entry.journalId)).toEqual([]);
  expect(parseStubState(storage.get(STUB_STORAGE_KEY) ?? "").feedback[entry.id]).toBeUndefined();
});

test("an in-flight sample request cannot restore a deleted entry", async () => {
  const entry = seed();
  const pending = requestFeedback(entry.id, "en");
  await deleteEntry(entry.id, "hard");
  await vi.runAllTimersAsync();
  expect(await pending).toEqual({ success: false, reason: "validation" });
  expect(await getEntry(entry.id)).toBeNull();
});

test("blocked browser storage reports failure instead of claiming deletion succeeded", async () => {
  const entry = seed();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: () => {
        throw new Error("Blocked");
      },
      setItem: () => {
        throw new Error("Blocked");
      },
    },
  });
  expect(await deleteEntry(entry.id, "soft")).toEqual({ success: false, reason: "unknown" });
});
