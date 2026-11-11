import { beforeEach, expect, test, vi } from "vitest";

vi.mock("../../src/lib/journal", () => ({
  createJournal: vi.fn(),
  createEntry: vi.fn(),
  getJournal: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import { createEntryAction, createJournalAction } from "../../src/app/journals/actions";
import { createEntry, createJournal, getJournal } from "../../src/lib/journal";
import { dictionaries } from "../../src/i18n/dictionaries";
import type { ErrorKey, Field } from "../../src/lib/journal/action-input";
import {
  entryActionSchema,
  journalActionSchema,
  mapIssues,
  parseEntryForm,
  parseJournalForm,
} from "../../src/lib/journal/action-input";

const id = "a898dc71-df35-425f-9ed1-6e79019cb1e7";
const journal = {
  id,
  language: "en",
  level: "new",
  focus: [],
  createdAt: "2026-11-11T12:00:00Z",
} satisfies Awaited<ReturnType<typeof createJournal>>;

function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of typeof value === "string" ? [value] : value) data.append(key, item);
  }
  return data;
}

beforeEach(() => vi.resetAllMocks());

const expectedErrors: Record<Exclude<Field, "form">, ErrorKey> = {
  language: "invalidLanguage",
  level: "invalidLevel",
  focus: "invalidFocus",
  journalId: "invalidJournal",
  body: "invalidBody",
  entryDate: "invalidDate",
};

test("every mapped field produces its expected error key", () => {
  for (const [field, key] of Object.entries(expectedErrors)) {
    expect(mapIssues([{ code: "custom", path: [field], message: "Invalid" }])).toEqual({
      success: false,
      errors: { [field]: key },
    });
  }
});

test("unmapped, missing, numeric and symbol paths produce a form error without throwing", () => {
  const paths: PropertyKey[][] = [
    ["unmapped"],
    [],
    [Symbol("body")],
    [0],
    ["toString"],
    ["__proto__"],
  ];
  for (const path of paths) {
    expect(mapIssues([{ code: "custom", path, message: "Invalid" }])).toEqual({
      success: false,
      errors: { form: "saveFailed" },
    });
  }
});

test("every mapped field has a translated message in en, es and it", () => {
  for (const field of Object.keys(expectedErrors)) {
    const result = mapIssues([{ code: "custom", path: [field], message: "Invalid" }]);
    if (result.success) throw new Error("Expected field errors");
    const keys = Object.values(result.errors);
    expect(keys).toHaveLength(1);
    for (const key of keys) {
      for (const dictionary of Object.values(dictionaries)) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  }
});

test("journal form reuses domain validation and accepts up to three configured focus areas", () => {
  expect(
    parseJournalForm(form({ language: "en", level: "basic", focus: ["travel", "work", "grammar"] }))
      .success,
  ).toBe(true);
  expect(parseJournalForm(form({ language: "it", level: "new" })).success).toBe(true);
  for (const focus of [
    ["other"],
    ["travel", "travel"],
    ["travel", "work", "grammar", "vocabulary"],
  ]) {
    const result = journalActionSchema.safeParse({ language: "en", level: "new", focus });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(mapIssues(result.error.issues)).toEqual({
        success: false,
        errors: { focus: "invalidFocus" },
      });
  }
});

test("entry form rejects blank writing, oversize Unicode text, invalid dates and invalid IDs", () => {
  for (const values of [
    { journalId: id, body: "  ", entryDate: "2026-11-11" },
    { journalId: id, body: "😀".repeat(5001), entryDate: "2026-11-11" },
    { journalId: id, body: "Hello", entryDate: "2026-02-30" },
    { journalId: "bad", body: "Hello", entryDate: "2026-11-11" },
  ])
    expect(parseEntryForm(form(values)).success).toBe(false);
  expect(
    parseEntryForm(form({ journalId: id, body: "😀".repeat(5000), entryDate: "2024-02-29" }))
      .success,
  ).toBe(true);
  const file = new FormData();
  file.set("body", new Blob(["hello"]), "entry.txt");
  expect(parseEntryForm(file).success).toBe(false);
});

test("issues map to localized field error keys, including nested focus and root errors", () => {
  const result = entryActionSchema.safeParse({
    journalId: "bad",
    body: "",
    entryDate: "bad",
    extra: true,
  });
  if (result.success) throw new Error("Expected invalid input");
  expect(mapIssues(result.error.issues)).toEqual({
    success: false,
    errors: {
      journalId: "invalidJournal",
      body: "invalidBody",
      entryDate: "invalidDate",
      form: "saveFailed",
    },
  });
});

test("invalid journal action input returns errors without writing", async () => {
  expect(await createJournalAction(new FormData())).toEqual({
    success: false,
    errors: { language: "invalidLanguage", level: "invalidLevel" },
  });
  expect(createJournal).not.toHaveBeenCalled();
});

test("successful journal writes return the id and revalidate the list", async () => {
  vi.mocked(createJournal).mockResolvedValue(journal);
  expect(await createJournalAction(form({ language: "en", level: "new" }))).toEqual({
    success: true,
    id,
  });
  expect(createJournal).toHaveBeenCalledWith({ language: "en", level: "new", focus: [] });
  expect(revalidatePath).toHaveBeenCalledWith("/journals");
});

test("journal persistence failures become a typed form error", async () => {
  vi.mocked(createJournal).mockRejectedValue(new Error("Database unavailable"));
  expect(await createJournalAction(form({ language: "en", level: "new" }))).toEqual({
    success: false,
    errors: { form: "saveFailed" },
  });
});

test("entry validation errors and missing journals never create entries", async () => {
  expect(await createEntryAction(new FormData())).toEqual({
    success: false,
    errors: { journalId: "invalidJournal", body: "invalidBody", entryDate: "invalidDate" },
  });
  vi.mocked(getJournal).mockResolvedValue(null);
  expect(
    await createEntryAction(form({ journalId: id, body: "Hello", entryDate: "2026-11-11" })),
  ).toEqual({ success: false, errors: { journalId: "invalidJournal" } });
  expect(createEntry).not.toHaveBeenCalled();
});

test("entry success returns the entry id and database failures map to form errors", async () => {
  vi.mocked(getJournal).mockResolvedValue(journal);
  const values = { journalId: id, body: " Hello\n", entryDate: "2026-11-11" };
  vi.mocked(createEntry).mockResolvedValue({
    ...values,
    id,
    createdAt: journal.createdAt,
    updatedAt: journal.createdAt,
  });
  expect(await createEntryAction(form(values))).toEqual({ success: true, id });
  expect(createEntry).toHaveBeenCalledWith(values);
  expect(revalidatePath).toHaveBeenCalledWith(`/journals/${id}`);
  vi.mocked(createEntry).mockRejectedValue(new Error("Database unavailable"));
  expect(await createEntryAction(form(values))).toEqual({
    success: false,
    errors: { form: "saveFailed" },
  });
});
