import { z } from "zod";
import { levels } from "../../config/domain";
import { localeSchema } from "../../config/locales";

export const idSchema = z.uuid();

export const createJournalSchema = z.strictObject({
  language: localeSchema,
  level: z.enum(levels),
  focus: z.array(z.string()).max(3).default([]),
});

function today(): string {
  const now = new Date();
  return [
    now.getFullYear().toString().padStart(4, "0"),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
  ].join("-");
}

export const createEntrySchema = z.strictObject({
  journalId: idSchema,
  body: z
    .string()
    .refine((body) => body.trim().length > 0, "Body must not be blank")
    .refine((body) => Array.from(body).length <= 5000, "Body must be at most 5000 characters"),
  entryDate: z.iso.date().default(today),
});

export type CreateJournalInput = z.input<typeof createJournalSchema>;
export type CreateEntryInput = z.input<typeof createEntrySchema>;
