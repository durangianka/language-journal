import { eq } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { client, db } from "../../src/db/client";
import { entries, journals } from "../../src/db/schema";
import {
  createEntry,
  createJournal,
  deleteEntry,
  deleteJournal,
  getEntry,
  getJournal,
  listEntries,
  restoreDeleted,
} from "../../src/lib/journal";

afterAll(async () => {
  await client.end();
});

test("journal Undo restores its entries while preserving entries already in trash", async () => {
  const journal = await createJournal({ language: "en", level: "basic", focus: [] });
  try {
    const olderTrash = await createEntry({
      journalId: journal.id,
      body: "Already in trash.",
      entryDate: "2026-11-09",
    });
    const active = await createEntry({
      journalId: journal.id,
      body: "Keep this entry.",
      entryDate: "2026-11-10",
    });
    await db
      .update(entries)
      .set({ deletedAt: new Date("2026-01-01T00:00:00Z") })
      .where(eq(entries.id, olderTrash.id));
    await deleteJournal(journal.id, "soft");
    await deleteJournal(journal.id, "soft");
    expect(await getJournal(journal.id)).toBeNull();
    expect(await getEntry(active.id)).toBeNull();
    await restoreDeleted(journal.id, "journal");
    expect(await getJournal(journal.id)).toEqual(journal);
    expect((await listEntries(journal.id)).map((entry) => entry.id)).toEqual([active.id]);
    expect(await getEntry(olderTrash.id)).toBeNull();
  } finally {
    await db.delete(journals).where(eq(journals.id, journal.id));
  }
});

test("entry Undo restores its body, rejects a deleted parent and cannot resurrect hard deletion", async () => {
  const journal = await createJournal({ language: "it", level: "basic", focus: [] });
  try {
    const entry = await createEntry({
      journalId: journal.id,
      body: "Oggi scrivo.",
      entryDate: "2026-11-10",
    });
    await deleteEntry(entry.id, "soft");
    expect(await getEntry(entry.id)).toBeNull();
    await restoreDeleted(entry.id, "entry");
    expect(await getEntry(entry.id)).toEqual(entry);
    await deleteJournal(journal.id, "soft");
    await expect(restoreDeleted(entry.id, "entry")).rejects.toThrow("Journal unavailable");
    await restoreDeleted(journal.id, "journal");
    await deleteEntry(entry.id, "hard");
    await expect(restoreDeleted(entry.id, "entry")).rejects.toThrow("Unavailable");
    expect(await getEntry(entry.id)).toBeNull();
  } finally {
    await db.delete(journals).where(eq(journals.id, journal.id));
  }
});
