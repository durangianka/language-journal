import "server-only";

import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../db/client";
import { entries, journalMistakeCounts, journals } from "../../db/schema";
import { refreshMistakeCounts } from "../insight/counts";
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

export async function countOccupiedEntrySlots(journalId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(entries)
    .innerJoin(journals, eq(entries.journalId, journals.id))
    .where(and(eq(journals.id, idSchema.parse(journalId)), isNull(journals.deletedAt)));
  return row.total;
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
    } else {
      await tx.delete(entries).where(eq(entries.id, id));
    }
    await refreshMistakeCounts(tx, source.journalId);
  });
}

export async function deleteJournal(id: string, mode: "soft" | "hard" = "soft") {
  idSchema.parse(id);
  await db.transaction(async (tx) => {
    const [journal] = await tx
      .select({ deletedAt: journals.deletedAt })
      .from(journals)
      .where(eq(journals.id, id))
      .for("update");
    if (!journal) return;
    if (mode === "hard") {
      await tx.delete(journals).where(eq(journals.id, id));
      return;
    }
    if (journal.deletedAt) return;
    const existing = await tx
      .select({ deletedAt: entries.deletedAt })
      .from(entries)
      .where(eq(entries.journalId, id));
    const now = new Date();
    // The marker identifies this deletion batch. Keep it distinct from earlier trash.
    while (existing.some((entry) => entry.deletedAt?.getTime() === now.getTime())) {
      now.setTime(now.getTime() + 1);
    }
    await tx.update(journals).set({ deletedAt: now }).where(eq(journals.id, id));
    await tx
      .update(entries)
      .set({ deletedAt: now })
      .where(and(eq(entries.journalId, id), isNull(entries.deletedAt)));
    await refreshMistakeCounts(tx, id);
  });
}

export async function getJournalMistakeCounts(journalId: string) {
  return db
    .select({ category: journalMistakeCounts.category, count: journalMistakeCounts.count })
    .from(journalMistakeCounts)
    .innerJoin(journals, eq(journalMistakeCounts.journalId, journals.id))
    .where(and(eq(journals.id, idSchema.parse(journalId)), isNull(journals.deletedAt)));
}

/** Restore only rows removed by the same journal deletion, preserving older trash. */
export async function restoreDeleted(id: string, kind: "entry" | "journal") {
  idSchema.parse(id);
  return db.transaction(async (tx) => {
    const source =
      kind === "entry"
        ? (
            await tx
              .select({ journalId: entries.journalId })
              .from(entries)
              .where(eq(entries.id, id))
          )[0]
        : { journalId: id };
    if (!source) throw new Error("Unavailable");
    const [journal] = await tx
      .select()
      .from(journals)
      .where(eq(journals.id, source.journalId))
      .for("update");
    if (!journal) throw new Error("Unavailable");
    if (kind === "journal") {
      if (journal.deletedAt) {
        await tx
          .update(entries)
          .set({ deletedAt: null })
          .where(and(eq(entries.journalId, id), eq(entries.deletedAt, journal.deletedAt)));
        await tx.update(journals).set({ deletedAt: null }).where(eq(journals.id, id));
      }
    } else {
      if (journal.deletedAt) throw new Error("Journal unavailable");
      const restored = await tx
        .update(entries)
        .set({ deletedAt: null })
        .where(eq(entries.id, id))
        .returning({ id: entries.id });
      if (!restored.length) throw new Error("Entry unavailable");
    }
    await refreshMistakeCounts(tx, source.journalId);
  });
}
