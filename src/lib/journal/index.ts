import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { entries, journals } from "../../db/schema";
import {
  createEntrySchema,
  createJournalSchema,
  idSchema,
  type CreateEntryInput,
  type CreateJournalInput,
} from "./schemas";
import type { Entry, Journal } from "./types";

export type { CreateEntryInput, CreateJournalInput } from "./schemas";
export type { Entry, Journal } from "./types";

function toJournal(row: typeof journals.$inferSelect): Journal {
  return {
    id: row.id,
    language: row.language,
    level: row.level,
    focus: row.focus,
    createdAt: row.createdAt.toISOString(),
  };
}

function toEntry(row: typeof entries.$inferSelect): Entry {
  return {
    id: row.id,
    journalId: row.journalId,
    body: row.body,
    entryDate: row.entryDate,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createJournal(input: CreateJournalInput): Promise<Journal> {
  const values = createJournalSchema.parse(input);
  // The AI feature will read focus as steering input, preserving the learner's choices.
  const [row] = await db.insert(journals).values(values).returning();
  return toJournal(row);
}

export async function listJournals(): Promise<Journal[]> {
  const rows = await db.select().from(journals).orderBy(desc(journals.createdAt));
  return rows.map(toJournal);
}

export async function getJournal(id: string): Promise<Journal | null> {
  const [row] = await db
    .select()
    .from(journals)
    .where(eq(journals.id, idSchema.parse(id)))
    .limit(1);
  return row ? toJournal(row) : null;
}

export async function createEntry(input: CreateEntryInput): Promise<Entry> {
  const values = createEntrySchema.parse(input);
  const [row] = await db.insert(entries).values(values).returning();
  return toEntry(row);
}

export async function listEntries(journalId: string): Promise<Entry[]> {
  const rows = await db
    .select()
    .from(entries)
    .where(eq(entries.journalId, idSchema.parse(journalId)))
    .orderBy(desc(entries.entryDate), desc(entries.createdAt));
  return rows.map(toEntry);
}

export async function getEntry(id: string): Promise<Entry | null> {
  const [row] = await db
    .select()
    .from(entries)
    .where(eq(entries.id, idSchema.parse(id)))
    .limit(1);
  return row ? toEntry(row) : null;
}
