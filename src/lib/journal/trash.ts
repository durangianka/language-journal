import "server-only";

import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, journals } from "@/db/schema";

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
