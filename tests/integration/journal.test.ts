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

test("creates journals and entries, sorts dates and creation times, and cascades deletion", async () => {
  const journal = await createJournal({
    language: "it", level: "basic", focus: ["travel"],
  });

  try {
    expect(journal).toMatchObject({ language: "it", level: "basic", focus: ["travel"] });
    expect(journal.createdAt).toEqual(expect.any(String));
    expect(await getJournal(journal.id)).toEqual(journal);
    expect(await listJournals()).toContainEqual(journal);
    expect(await listEntries(journal.id)).toEqual([]);

    const newer = await createEntry({
      journalId: journal.id, body: "Oggi scrivo.", entryDate: "2026-02-02",
    });
    const older = await createEntry({
      journalId: journal.id, body: "  Ieri ho letto.\n", entryDate: "2026-02-01",
    });
    expect(await listEntries(journal.id)).toEqual([newer, older]);
    expect(await getEntry(older.id)).toEqual(older);
    expect(older.body).toBe("  Ieri ho letto.\n");
    expect(older.updatedAt).toEqual(expect.any(String));

    // Set explicit instants to test the secondary order without timing sleeps.
    await db.update(entries)
      .set({ entryDate: "2026-02-02", createdAt: new Date("2026-02-03T12:00:00Z") })
      .where(eq(entries.id, older.id));
    await db.update(entries)
      .set({ createdAt: new Date("2026-02-03T11:00:00Z") })
      .where(eq(entries.id, newer.id));
    expect((await listEntries(journal.id)).map((entry) => entry.id)).toEqual([older.id, newer.id]);
    expect(await getJournal(randomUUID())).toBeNull();
    expect(await getEntry(randomUUID())).toBeNull();

    // Invalid direct writes must also be rejected by Postgres.
    await expect(db.insert(entries).values({
      journalId: journal.id, body: "\t\n ", entryDate: "2026-02-02",
    })).rejects.toThrow();
    await expect(db.insert(entries).values({
      journalId: journal.id, body: "a".repeat(5001), entryDate: "2026-02-02",
    })).rejects.toThrow();
    await expect(
      db.update(journals)
        .set({ focus: ["a", "b", "c", "d"] })
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
