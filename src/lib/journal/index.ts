import "server-only";

import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { entries, feedback, journalMistakeCounts, journals } from "../../db/schema";
import { JournalFullError } from "./errors";
import { latestFeedback, latestFeedbackForEntries } from "../ai/repository";
import { LIMITS, type FeedbackDto } from "../feedback-contract";
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

function toEntry(row: typeof entries.$inferSelect, latest: FeedbackDto | null = null): Entry {
  return {
    id: row.id,
    journalId: row.journalId,
    body: row.body,
    entryDate: row.entryDate,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    latestFeedback: latest,
  };
}

export async function createJournal(input: CreateJournalInput): Promise<Journal> {
  const values = createJournalSchema.parse(input);
  // The AI feature will read focus as steering input, preserving the learner's choices.
  const [row] = await db.insert(journals).values(values).returning();
  return toJournal(row);
}

export async function listJournals(): Promise<Journal[]> {
  const rows = await db
    .select()
    .from(journals)
    .where(isNull(journals.deletedAt))
    .orderBy(desc(journals.createdAt));
  return rows.map(toJournal);
}

export async function getJournal(id: string): Promise<Journal | null> {
  const [row] = await db
    .select()
    .from(journals)
    .where(and(eq(journals.id, idSchema.parse(id)), isNull(journals.deletedAt)))
    .limit(1);
  return row ? toJournal(row) : null;
}

export async function createEntry(input: CreateEntryInput): Promise<Entry> {
  const values = createEntrySchema.parse(input);
  return db.transaction(async (tx) => {
    const [journal] = await tx
      .select()
      .from(journals)
      .where(and(eq(journals.id, values.journalId), isNull(journals.deletedAt)))
      .for("update");
    if (!journal) throw new Error("Journal unavailable");
    // Deleted entries occupy a slot, preserving the journal's lifetime cap.
    const [existing] = await tx
      .select({ total: count() })
      .from(entries)
      .where(eq(entries.journalId, values.journalId));
    if (existing.total >= LIMITS.entriesPerJournal) throw new JournalFullError();
    const [row] = await tx.insert(entries).values(values).returning();
    return toEntry(row);
  });
}

export async function listEntries(journalId: string): Promise<Entry[]> {
  const rows = await db
    .select({ entry: entries })
    .from(entries)
    .innerJoin(journals, eq(entries.journalId, journals.id))
    .where(
      and(
        eq(entries.journalId, idSchema.parse(journalId)),
        isNull(entries.deletedAt),
        isNull(journals.deletedAt),
      ),
    )
    .orderBy(desc(entries.entryDate), desc(entries.createdAt));
  const latest = await latestFeedbackForEntries(rows.map(({ entry }) => entry.id));
  return rows.map(({ entry }) => toEntry(entry, latest.get(entry.id) ?? null));
}

export async function getEntry(id: string): Promise<Entry | null> {
  const [row] = await db
    .select({ entry: entries })
    .from(entries)
    .innerJoin(journals, eq(entries.journalId, journals.id))
    .where(
      and(
        eq(entries.id, idSchema.parse(id)),
        isNull(entries.deletedAt),
        isNull(journals.deletedAt),
      ),
    )
    .limit(1);
  return row ? toEntry(row.entry, await latestFeedback(id)) : null;
}

export async function updateEntry(id: string, input: CreateEntryInput): Promise<Entry | null> {
  const values = createEntrySchema.parse(input);
  return db.transaction(async (tx) => {
    const [journal] = await tx
      .select()
      .from(journals)
      .where(and(eq(journals.id, values.journalId), isNull(journals.deletedAt)))
      .for("update");
    if (!journal) return null;
    const [row] = await tx
      .update(entries)
      .set({ body: values.body, entryDate: values.entryDate, updatedAt: new Date() })
      .where(
        and(
          eq(entries.id, idSchema.parse(id)),
          eq(entries.journalId, values.journalId),
          isNull(entries.deletedAt),
        ),
      )
      .returning();
    return row ? toEntry(row, await latestFeedback(id)) : null;
  });
}

export async function deleteEntry(id: string, mode: "soft" | "hard" = "soft") {
  idSchema.parse(id);
  await db.transaction(async (tx) => {
    const [source] = await tx
      .select({ journalId: entries.journalId })
      .from(entries)
      .where(eq(entries.id, id));
    if (!source) return;
    await tx
      .select({ id: journals.id })
      .from(journals)
      .where(eq(journals.id, source.journalId))
      .for("update");
    if (mode === "soft") {
      await tx.update(entries).set({ deletedAt: new Date() }).where(eq(entries.id, id));
      return;
    }
    const history = await tx
      .select({ corrections: feedback.corrections })
      .from(feedback)
      .where(and(eq(feedback.entryId, id), eq(feedback.status, "ready")));
    for (const row of history)
      for (const correction of row.corrections ?? []) {
        await tx
          .update(journalMistakeCounts)
          .set({ count: sql`greatest(0, ${journalMistakeCounts.count} - 1)` })
          .where(
            and(
              eq(journalMistakeCounts.journalId, source.journalId),
              eq(journalMistakeCounts.category, correction.category),
            ),
          );
      }
    await tx
      .delete(journalMistakeCounts)
      .where(
        and(
          eq(journalMistakeCounts.journalId, source.journalId),
          eq(journalMistakeCounts.count, 0),
        ),
      );
    await tx.delete(entries).where(eq(entries.id, id));
  });
}

export async function deleteJournal(id: string, mode: "soft" | "hard" = "soft") {
  idSchema.parse(id);
  await db.transaction(async (tx) => {
    await tx.select({ id: journals.id }).from(journals).where(eq(journals.id, id)).for("update");
    if (mode === "hard") {
      await tx.delete(journals).where(eq(journals.id, id));
      return;
    }
    const now = new Date();
    await tx.update(journals).set({ deletedAt: now }).where(eq(journals.id, id));
    await tx.update(entries).set({ deletedAt: now }).where(eq(entries.journalId, id));
  });
}

export async function getJournalMistakeCounts(journalId: string) {
  return db
    .select({ category: journalMistakeCounts.category, count: journalMistakeCounts.count })
    .from(journalMistakeCounts)
    .innerJoin(journals, eq(journalMistakeCounts.journalId, journals.id))
    .where(and(eq(journals.id, idSchema.parse(journalId)), isNull(journals.deletedAt)));
}
