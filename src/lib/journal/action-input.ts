import { z } from "zod";
import { createEntrySchema, createJournalSchema } from "./schemas";

export const journalActionSchema = createJournalSchema;
export const entryActionSchema = createEntrySchema;

export type Field = "language" | "level" | "focus" | "journalId" | "body" | "entryDate" | "form";
export type ErrorKey =
  | "invalidLanguage"
  | "invalidLevel"
  | "invalidFocus"
  | "invalidJournal"
  | "invalidBody"
  | "invalidDate"
  | "saveFailed";
export type FieldErrors = Partial<Record<Field, ErrorKey>>;
export type ActionResult = { success: true; id: string } | { success: false; errors: FieldErrors };

type MappedField = Exclude<Field, "form">;

const errorByField: Record<MappedField, ErrorKey> = {
  language: "invalidLanguage",
  level: "invalidLevel",
  focus: "invalidFocus",
  journalId: "invalidJournal",
  body: "invalidBody",
  entryDate: "invalidDate",
};

function isMappedField(value: PropertyKey | undefined): value is MappedField {
  return typeof value === "string" && Object.hasOwn(errorByField, value);
}

export function mapIssues(issues: readonly z.core.$ZodIssue[]): ActionResult {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (isMappedField(field)) {
      errors[field] = errorByField[field];
    } else {
      errors.form = "saveFailed";
    }
  }
  return { success: false, errors };
}

export function parseJournalForm(form: FormData) {
  return journalActionSchema.safeParse({
    language: form.get("language"),
    level: form.get("level"),
    focus: form.getAll("focus"),
  });
}

export function parseEntryForm(form: FormData) {
  return entryActionSchema.safeParse({
    journalId: form.get("journalId"),
    body: form.get("body"),
    entryDate: form.get("entryDate"),
  });
}
