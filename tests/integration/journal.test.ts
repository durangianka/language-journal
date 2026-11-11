import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";

// The repository runs on the server. Vitest's Node environment is also a server,
// but does not enable Next.js's react-server export condition.
vi.mock("server-only", () => ({}));

import { client, db } from "../../src/db/client";
import { entries, journals } from "../../src/db/schema";
import {
  createEntry,
  createJournal,
  getEntry,
  getJournal,
  listEntries,
  listJournals,
} from "../../src/lib/journal";

afterAll(async () => {
  await client.end();
});

for (const [level, limit] of [
  ["new", 1],
  ["basic", 2],
  ["intermediate", 3],
  ["advanced", 3],
] as const) {
  test(`persists focus order and enforces ${level} limit in Postgres`, async () => {
    const choices = ["grammar", "food", "travel", "work"] as const;
    const journal = await createJournal({ language: "en", level, focus: choices.slice(0, limit) });
    try {
      expect((await getJournal(journal.id))?.focus).toEqual(choices.slice(0, limit));
      for (const count of [0, limit - 1, limit]) {
        const [row] = await db
          .update(journals)
          .set({ focus: choices.slice(0, count) })
          .where(eq(journals.id, journal.id))
          .returning();
        expect(row.focus).toEqual(choices.slice(0, count));
      }
      await expect(
        db
          .update(journals)
          .set({ focus: choices.slice(0, limit + 1) })
          .where(eq(journals.id, journal.id)),
      ).rejects.toThrow();
    } finally {
      await db.delete(journals).where(eq(journals.id, journal.id));
    }
  });
}

test("creates journals and entries, sorts dates and creation times, and cascades deletion", async () => {
  const journal = await createJournal({
    language: "it",
    level: "basic",
    focus: ["travel"],
  });

  try {
    expect(journal).toMatchObject({ language: "it", level: "basic", focus: ["travel"] });
    expect(journal.createdAt).toEqual(expect.any(String));
    expect(await getJournal(journal.id)).toEqual(journal);
    expect(await listJournals()).toContainEqual(journal);
    expect(await listEntries(journal.id)).toEqual([]);

    const newer = await createEntry({
      journalId: journal.id,
      body: "Oggi scrivo.",
      entryDate: "2026-02-02",
    });
    const older = await createEntry({
      journalId: journal.id,
      body: "  Ieri ho letto.\n",
      entryDate: "2026-02-01",
    });
    expect(await listEntries(journal.id)).toEqual([newer, older]);
    expect(await getEntry(older.id)).toEqual(older);
    expect(older.body).toBe("  Ieri ho letto.\n");
    expect(older.updatedAt).toEqual(expect.any(String));

    // Set explicit instants to test the secondary order without timing sleeps.
    await db
      .update(entries)
      .set({ entryDate: "2026-02-02", createdAt: new Date("2026-02-03T12:00:00Z") })
      .where(eq(entries.id, older.id));
    await db
      .update(entries)
      .set({ createdAt: new Date("2026-02-03T11:00:00Z") })
      .where(eq(entries.id, newer.id));
    expect((await listEntries(journal.id)).map((entry) => entry.id)).toEqual([older.id, newer.id]);
    expect(await getJournal(randomUUID())).toBeNull();
    expect(await getEntry(randomUUID())).toBeNull();

    for (const focus of [[], ["travel"], ["travel", "food"]]) {
      const [updated] = await db
        .update(journals)
        .set({ focus })
        .where(eq(journals.id, journal.id))
        .returning();
      expect(updated.focus).toEqual(focus);
    }

    // Invalid direct writes must also be rejected by Postgres.
    await expect(
      db.insert(entries).values({
        journalId: journal.id,
        body: "\t\n ",
        entryDate: "2026-02-02",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(entries).values({
        journalId: journal.id,
        body: "a".repeat(5001),
        entryDate: "2026-02-02",
      }),
    ).rejects.toThrow();
    await expect(
      db
        .update(journals)
        .set({ focus: ["travel", "work", "grammar"] })
        .where(eq(journals.id, journal.id)),
    ).rejects.toThrow();

    await db.delete(journals).where(eq(journals.id, journal.id));
    expect(await getJournal(journal.id)).toBeNull();
    expect(await getEntry(newer.id)).toBeNull();
    expect(await getEntry(older.id)).toBeNull();
    expect(await listEntries(journal.id)).toEqual([]);
  } finally {
    await db.delete(journals).where(eq(journals.id, journal.id));
  }
});
