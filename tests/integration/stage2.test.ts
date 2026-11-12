import { afterAll, afterEach, expect, test, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
vi.mock("server-only", () => ({}));
import { client, db } from "../../src/db/client";
import { entries, jevCalls, journalInsights, journals, modelCalls } from "../../src/db/schema";
import { createEntry, createJournal, deleteEntry } from "../../src/lib/journal";
import { summariseJournal } from "../../src/lib/insight/repository";
import { jevStore } from "../../src/lib/jev/repository";

const ids: string[] = [];
async function fixture() {
  const journal = await createJournal({ language: "en", level: "basic", focus: [] });
  ids.push(journal.id);
  const entry = await createEntry({ journalId: journal.id, body: "Today I walked to the market." });
  return { journal, entry };
}
afterEach(async () => {
  for (const id of ids.splice(0)) await db.delete(journals).where(eq(journals.id, id));
  await db.delete(jevCalls);
});
afterAll(async () => {
  await client.end();
});

test("summary excludes trashed entries, uses current locale, persists one call and refuses concurrent duplicates", async () => {
  const { journal, entry } = await fixture();
  const removed = await createEntry({ journalId: journal.id, body: "DELETED INPUT" });
  await deleteEntry(removed.id, "soft");
  const provider = vi.fn(async () => ({
    text: "Practica los verbos.",
    inputTokens: 50,
    outputTokens: 20,
  }));
  const results = await Promise.all([
    summariseJournal(journal.id, "es", provider),
    summariseJournal(journal.id, "es", provider),
  ]);
  expect(provider).toHaveBeenCalledExactlyOnceWith({ entries: [entry.body], locale: "es" });
  expect(results.some((r) => r.summary === "Practica los verbos.")).toBe(true);
  expect(results.some((r) => r.reason === "daily")).toBe(true);
  const [call] = await db.select().from(modelCalls).where(eq(modelCalls.journalId, journal.id));
  expect(call).toMatchObject({
    kind: "insight",
    outcome: "ready",
    inputTokens: 50,
    outputTokens: 20,
  });
  expect(await summariseJournal(journal.id, "it", provider)).toEqual({
    summary: null,
    reason: "daily",
  });
});
test("summary shares the 50 model-call cap with feedback", async () => {
  const { journal, entry } = await fixture();
  await db
    .insert(modelCalls)
    .values(
      Array.from({ length: 50 }, () => ({
        journalId: journal.id,
        kind: "insight" as const,
        outcome: "ready" as const,
      })),
    );
  const provider = vi.fn();
  expect(await summariseJournal(journal.id, "en", provider)).toEqual({
    summary: null,
    reason: "daily",
  });
  expect(provider).not.toHaveBeenCalled();
  expect(entry.id).toBeTruthy();
});
test("failed summary is logged once and cannot retry that journal today", async () => {
  const { journal } = await fixture();
  const provider = vi.fn(async () => {
    throw new Error("unavailable");
  });
  expect(await summariseJournal(journal.id, "en", provider)).toEqual({
    summary: null,
    reason: "failed",
  });
  expect(await summariseJournal(journal.id, "en", provider)).toEqual({
    summary: null,
    reason: "daily",
  });
  expect(provider).toHaveBeenCalledTimes(1);
  const [record] = await db.select().from(modelCalls).where(eq(modelCalls.journalId, journal.id));
  expect(record.outcome).toBe("failed");
  expect(
    await db.select().from(journalInsights).where(eq(journalInsights.journalId, journal.id)),
  ).toHaveLength(1);
});
test("Jev reservations serialize the last daily slot and preserve logs after entry deletion", async () => {
  const { entry } = await fixture();
  await db.insert(jevCalls).values(Array.from({ length: 199 }, () => ({ questions: {} })));
  const result = await Promise.all([jevStore.reserve(entry.id), jevStore.reserve(entry.id)]);
  expect(result.filter(Boolean)).toHaveLength(1);
  await db.delete(entries).where(eq(entries.id, entry.id));
  const total = await db.execute(sql`select count(*)::integer as total from jev_calls`);
  expect(total[0].total).toBe(200);
  expect(await jevStore.reserve(null)).toBeNull();
});
