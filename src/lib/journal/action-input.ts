import { z } from "zod";
import { focusAreas } from "../../config/domain";
import { createEntrySchema, createJournalSchema } from "./schemas";

export const journalActionSchema = createJournalSchema.extend({
  focus: z
    .array(z.enum(focusAreas))
    .max(3)
    .refine((items) => new Set(items).size === items.length),
});
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

export function mapIssues(issues: readonly z.core.$ZodIssue[]): ActionResult {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    switch (issue.path[0]) {
      case "language":
        errors.language = "invalidLanguage";
        break;
      case "level":
        errors.level = "invalidLevel";
        break;
      case "focus":
        errors.focus = "invalidFocus";
        break;
      case "journalId":
        errors.journalId = "invalidJournal";
        break;
      case "body":
        errors.body = "invalidBody";
        break;
      case "entryDate":
        errors.entryDate = "invalidDate";
        break;
      default:
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
