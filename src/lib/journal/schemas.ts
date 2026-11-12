import { z } from "zod";
import { focusAreas, maxFocusByLevel } from "../../config/focus";
import { levels } from "../../config/domain";
import { localeSchema } from "../../config/locales";
import { today } from "./dates";
import { LIMITS } from "../feedback-contract";

export const idSchema = z.uuid();

export const createJournalSchema = z
  .strictObject({
    language: localeSchema,
    level: z.enum(levels),
    focus: z
      .array(z.enum(focusAreas))
      .refine((items) => new Set(items).size === items.length)
      .default([]),
  })
  .refine(({ level, focus }) => focus.length <= maxFocusByLevel[level], {
    path: ["focus"],
    message: "Too many focus areas for the selected level",
  });

export const createEntrySchema = z.strictObject({
  journalId: idSchema,
  body: z
    .string()
    .refine((body) => body.trim().length > 0, "Body must not be blank")
    .refine(
      (body) => Array.from(body).length <= LIMITS.entryMaxChars,
      "Body must be at most 2000 characters",
    ),
  entryDate: z.iso.date().default(today),
});

export type CreateJournalInput = z.input<typeof createJournalSchema>;
export type CreateEntryInput = z.input<typeof createEntrySchema>;
