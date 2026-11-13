import "server-only";

import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, journals } from "@/db/schema";
import { refreshMistakeCounts } from "../insight/counts";

/** Re-read current trash under the same parent locks used by restore and create. */
export async function emptyTrash() {
  await db.transaction(async (tx) => {
    const candidates = await tx
      .select({ id: journals.id })
      .from(journals)
      .where(
        sql`${journals.deletedAt} is not null or exists (
        select 1 from ${entries} where ${entries.journalId} = ${journals.id}
          and ${entries.deletedAt} is not null
      )`,
      )
      .orderBy(asc(journals.id));
    for (const candidate of candidates) {
      const [journal] = await tx
        .select({ deletedAt: journals.deletedAt })
        .from(journals)
        .where(eq(journals.id, candidate.id))
        .for("update");
      if (!journal) continue;
      if (journal.deletedAt) {
        await tx
          .delete(journals)
          .where(and(eq(journals.id, candidate.id), isNotNull(journals.deletedAt)));
      } else {
        const removed = await tx
          .delete(entries)
          .where(and(eq(entries.journalId, candidate.id), isNotNull(entries.deletedAt)))
          .returning({ id: entries.id });
        if (removed.length) await refreshMistakeCounts(tx, candidate.id);
      }
    }
  });
}

export interface TrashItem {
  id: string;
  kind: "entry" | "journal";
  journalId: string;
  language: "en" | "es" | "it";
  body: string | null;
  entryDate: string | null;
}

/** Deleted journals own their batch of entries, so show that batch once. */
export async function listTrash(): Promise<TrashItem[]> {
  const [deletedJournals, deletedEntries] = await Promise.all([
    db
      .select({ id: journals.id, language: journals.language })
      .from(journals)
      .where(isNotNull(journals.deletedAt))
      .orderBy(desc(journals.deletedAt)),
    db
      .select({
        id: entries.id,
        journalId: entries.journalId,
        language: journals.language,
        body: entries.body,
        entryDate: entries.entryDate,
      })
      .from(entries)
      .innerJoin(journals, eq(entries.journalId, journals.id))
      .where(and(isNotNull(entries.deletedAt), isNull(journals.deletedAt)))
      .orderBy(desc(entries.deletedAt)),
  ]);
  return [
    ...deletedJournals.map((journal): TrashItem => ({
      ...journal,
      kind: "journal",
      journalId: journal.id,
      body: null,
      entryDate: null,
    })),
    ...deletedEntries.map((entry): TrashItem => ({ ...entry, kind: "entry" })),
  ];
}
