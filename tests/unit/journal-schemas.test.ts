import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createEntrySchema,
  createJournalSchema,
  idSchema,
} from "../../src/lib/journal/schemas";

const journalId = "a898dc71-df35-425f-9ed1-6e79019cb1e7";

describe("idSchema", () => {
  test("accepts UUIDs", () => {
    expect(idSchema.parse(journalId)).toBe(journalId);
  });

  test.each(["", "not-a-uuid", "123", null, 12])("rejects invalid ID %j", (id) => {
    expect(idSchema.safeParse(id).success).toBe(false);
  });
});

describe("createJournalSchema", () => {
  test.each(["en", "es", "it"])("accepts language %s", (language) => {
    expect(createJournalSchema.parse({ language, level: "new" }).focus).toEqual([]);
  });

  test.each(["new", "basic", "intermediate", "advanced"])("accepts level %s", (level) => {
    expect(createJournalSchema.parse({ language: "en", level, focus: [] }).level).toBe(level);
  });

  test("accepts three focus items", () => {
    const input = { language: "it", level: "advanced", focus: ["travel", "work", "food"] };
    expect(createJournalSchema.parse(input)).toEqual(input);
  });

  test.each([
    {},
    { language: "fr", level: "new" },
    { language: "EN", level: "new" },
    { language: "en", level: "expert" },
    { language: "en" },
    { level: "basic" },
    { language: "en", level: "new", focus: ["a", "b", "c", "d"] },
    { language: "en", level: "new", focus: "travel" },
    { language: "en", level: "new", focus: [1] },
    { language: "en", level: "new", focus: null },
    { language: "en", level: "new", userId: journalId },
  ])("rejects invalid journal %j", (input) => {
    expect(createJournalSchema.safeParse(input).success).toBe(false);
  });
});

describe("createEntrySchema", () => {
  afterEach(() => vi.useRealTimers());

  test("preserves writing whitespace and accepts a leap day", () => {
    const input = { journalId, body: "  Ciao!\n", entryDate: "2024-02-29" };
    expect(createEntrySchema.parse(input)).toEqual(input);
  });

  test.each(["a".repeat(5000), "😀".repeat(5000)])("accepts 5000 characters (%#)", (body) => {
    expect(createEntrySchema.parse({ journalId, body }).body).toBe(body);
  });

  test("defaults to the app's local date at parse time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 2, 0, 30));
    expect(createEntrySchema.parse({ journalId, body: "Today" }).entryDate).toBe("2026-01-02");
    vi.setSystemTime(new Date(2026, 0, 3, 0, 30));
    expect(createEntrySchema.parse({ journalId, body: "Tomorrow" }).entryDate).toBe("2026-01-03");
  });

  test.each(["", " ", "\t\r\n", "\u00a0", "\u2003", "a".repeat(5001), "😀".repeat(5001), null, 123])(
    "rejects invalid body (%#)",
    (body) => {
      expect(createEntrySchema.safeParse({ journalId, body }).success).toBe(false);
    },
  );

  test.each(["2025-02-29", "2026-02-30", "2026-13-01", "2026-04-31", "2026-1-01", "2026-01-01T00:00:00Z", "", null])(
    "rejects invalid entry date %j",
    (entryDate) => {
      expect(createEntrySchema.safeParse({ journalId, body: "Ciao", entryDate }).success).toBe(false);
    },
  );

  test.each([
    {},
    { journalId },
    { body: "Ciao" },
    { journalId: "invalid", body: "Ciao" },
    { journalId, body: "Ciao", extra: true },
  ])("rejects invalid entry %j", (input) => {
    expect(createEntrySchema.safeParse(input).success).toBe(false);
  });
});
