import { randomUUID } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { client, db } from "../../src/db/client";
import {
  entries,
  feedback,
  journalMistakeCounts,
  journals,
  modelCalls,
  jevCalls,
} from "../../src/db/schema";
import {
  beginFeedback,
  feedbackStore,
  listFeedback,
  refuseNonLanguageFeedback,
} from "../../src/lib/ai/repository";
import { checkEntryLanguage } from "../../src/lib/jev/service";
import { jevStore } from "../../src/lib/jev/repository";
import { testJevClient } from "../../src/lib/jev/test-client";
import { runFeedback } from "../../src/lib/ai/service";
import {
  createEntry,
  createJournal,
  deleteEntry,
  deleteJournal,
  getEntry,
  getJournal,
  getJournalMistakeCounts,
  listEntries,
  listJournals,
  updateEntry,
} from "../../src/lib/journal";

const journalIds: string[] = [];
async function fixture() {
  const journal = await createJournal({ language: "es", level: "basic", focus: ["grammar"] });
  journalIds.push(journal.id);
  const entry = await createEntry({ journalId: journal.id, body: "Yo ir al mercado." });
  return { journal, entry };
}
const output = {
  corrected_text: "Yo fui al mercado.",
  corrections: [
    {
      original: "ir",
      fix: "fui",
      category: "grammar" as const,
      explanation: "Use the past tense when describing an action that has already finished.",
    },
  ],
};
const fake = {
  generate: vi.fn(async () => ({
    text: JSON.stringify(output),
    inputTokens: 10,
    outputTokens: 20,
  })),
};
afterEach(async () => {
  for (const id of journalIds.splice(0)) await db.delete(journals).where(eq(journals.id, id));
  await db.delete(modelCalls);
  await db.delete(jevCalls);
  fake.generate.mockClear();
});
afterAll(async () => {
  await client.end();
});

test("snapshot, pending and ready DTOs, history, counters, duplicate delivery and editing", async () => {
  const { journal, entry } = await fixture();
  const job = await beginFeedback(entry.id, "en");
  expect(job.input).toMatchObject({
    analysedText: entry.body,
    language: "es",
    locale: "en",
    level: "basic",
    focus: ["grammar"],
  });
  expect(job.feedback).toMatchObject({
    status: "pending",
    reason: null,
    corrections: [],
    correctedText: null,
  });
  const edited = await updateEntry(entry.id, { journalId: journal.id, body: "Hoy escribo." });
  expect(edited?.body).toBe("Hoy escribo.");
  await runFeedback(job, feedbackStore, fake);
  const latest = (await getEntry(entry.id))?.latestFeedback;
  expect(latest).toMatchObject({
    status: "ready",
    locale: "en",
    correctedText: output.corrected_text,
    corrections: output.corrections,
  });
  expect(latest).not.toHaveProperty("analysedText");
  expect((await listEntries(journal.id))[0].latestFeedback).toEqual(latest);
  const [saved] = await db.select().from(feedback).where(eq(feedback.id, job.id));
  expect(saved.analysedText).toBe(entry.body);
  expect(saved.attempts).toBe(1);
  await runFeedback(job, feedbackStore, fake);
  expect(fake.generate).toHaveBeenCalledTimes(1);
  expect(await getJournalMistakeCounts(journal.id)).toEqual([{ category: "grammar", count: 1 }]);
  const [call] = await db.select().from(modelCalls).where(eq(modelCalls.id, job.callId));
  expect(call).toMatchObject({
    kind: "analysis",
    outcome: "ready",
    inputTokens: 10,
    outputTokens: 20,
  });
});

test("concurrent entry requests stop at three, with no extra model reservation", async () => {
  const { entry } = await fixture();
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, () => beginFeedback(entry.id, "it")),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  for (const r of results)
    if (r.status === "rejected") expect(r.reason.reason).toBe("entry_limit_reached");
  expect(await listFeedback(entry.id)).toHaveLength(3);
  const [calls] = await db
    .select({ total: count() })
    .from(modelCalls)
    .where(eq(modelCalls.entryId, entry.id));
  expect(calls.total).toBe(3);
});

test("daily cap reserves the fiftieth slot once across concurrent entries", async () => {
  const { journal, entry } = await fixture();
  const seed = await beginFeedback(entry.id, "en");
  await db.insert(modelCalls).values(
    Array.from({ length: 48 }, () => ({
      feedbackId: seed.id,
      entryId: entry.id,
      kind: "retry" as const,
      outcome: "failed" as const,
    })),
  );
  const other = await createEntry({ journalId: journal.id, body: "Otro texto." });
  const results = await Promise.allSettled([
    beginFeedback(entry.id, "en"),
    beginFeedback(other.id, "en"),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  for (const r of results)
    if (r.status === "rejected") expect(r.reason.reason).toBe("daily_cap_reached");
  await expect(beginFeedback(other.id, "en")).rejects.toMatchObject({
    reason: "daily_cap_reached",
  });
  const [calls] = await db.select({ total: count() }).from(modelCalls);
  expect(calls.total).toBe(50);
  // The last slot cannot be exceeded by a repair either.
  const winner = results.find((r) => r.status === "fulfilled");
  if (winner?.status !== "fulfilled") throw new Error("Expected reservation");
  await runFeedback(winner.value, feedbackStore, {
    generate: async () => ({ text: "{}", inputTokens: 1, outputTokens: 1 }),
  });
  expect(
    (await listFeedback(winner.value.entryId)).find((f) => f.id === winner.value.id)?.reason,
  ).toBe("daily_cap_reached");
});

test("old calls do not count toward the current London day, including DST boundaries", async () => {
  const { entry } = await fixture();
  const first = await beginFeedback(entry.id, "en");
  await db.insert(modelCalls).values(
    Array.from({ length: 50 }, () => ({
      feedbackId: first.id,
      entryId: entry.id,
      kind: "retry" as const,
      outcome: "failed" as const,
      createdAt: new Date("2000-01-01Z"),
    })),
  );
  expect((await beginFeedback(entry.id, "en")).feedback.status).toBe("pending");
  const days = await db.execute(sql`select
    extract(epoch from ((timestamp '2026-03-30' at time zone 'Europe/London') - (timestamp '2026-03-29' at time zone 'Europe/London'))) / 3600 as spring,
    extract(epoch from ((timestamp '2026-10-26' at time zone 'Europe/London') - (timestamp '2026-10-25' at time zone 'Europe/London'))) / 3600 as autumn`);
  expect(Number(days[0].spring)).toBe(23);
  expect(Number(days[0].autumn)).toBe(25);
});

test("soft deletion hides entry, feedback and counts; hard deletion retains metering", async () => {
  const { journal, entry } = await fixture();
  const job = await beginFeedback(entry.id, "en");
  await runFeedback(job, feedbackStore, fake);
  await deleteEntry(entry.id, "soft");
  expect(await getEntry(entry.id)).toBeNull();
  expect(await listEntries(journal.id)).toEqual([]);
  expect(await listFeedback(entry.id)).toEqual([]);
  expect(await getJournalMistakeCounts(journal.id)).toEqual([]);
  await expect(beginFeedback(entry.id, "en")).rejects.toMatchObject({ reason: "validation" });
  await deleteEntry(entry.id, "hard");
  expect(await getJournalMistakeCounts(journal.id)).toEqual([]);
  expect(await db.select().from(feedback).where(eq(feedback.entryId, entry.id))).toEqual([]);
  expect(await db.select().from(modelCalls).where(eq(modelCalls.entryId, entry.id))).toEqual([]);
  expect(await db.select().from(modelCalls).where(eq(modelCalls.id, job.callId))).toMatchObject([
    { feedbackId: null, entryId: null, outcome: "ready" },
  ]);
});

test("soft deleted journals hide child data and counts; hard delete retains metering", async () => {
  const { journal, entry } = await fixture();
  const job = await beginFeedback(entry.id, "en");
  await runFeedback(job, feedbackStore, fake);
  await deleteJournal(journal.id, "soft");
  expect(await getJournal(journal.id)).toBeNull();
  expect(await listJournals()).not.toContainEqual(journal);
  expect(await getEntry(entry.id)).toBeNull();
  expect(await listEntries(journal.id)).toEqual([]);
  expect(await listFeedback(entry.id)).toEqual([]);
  expect(await getJournalMistakeCounts(journal.id)).toEqual([]);
  expect(
    await db
      .select()
      .from(journalMistakeCounts)
      .where(eq(journalMistakeCounts.journalId, journal.id)),
  ).toHaveLength(0);
  await expect(createEntry({ journalId: journal.id, body: "Hidden" })).rejects.toThrow();
  await deleteJournal(journal.id, "hard");
  expect(await db.select().from(entries).where(eq(entries.journalId, journal.id))).toEqual([]);
  expect(
    await db
      .select()
      .from(journalMistakeCounts)
      .where(eq(journalMistakeCounts.journalId, journal.id)),
  ).toEqual([]);
});

test("ten entry journal cap is serialized, deleted slots count, editing is free", async () => {
  const { journal, entry } = await fixture();
  const writes = await Promise.allSettled(
    Array.from({ length: 12 }, () => createEntry({ journalId: journal.id, body: "Texto" })),
  );
  expect(writes.filter((r) => r.status === "fulfilled")).toHaveLength(9);
  await deleteEntry(entry.id, "soft");
  await expect(createEntry({ journalId: journal.id, body: "One more" })).rejects.toThrow(
    "10 entries",
  );
  const visible = (await listEntries(journal.id))[0];
  expect((await updateEntry(visible.id, { journalId: journal.id, body: "Changed" }))?.body).toBe(
    "Changed",
  );
});

test("database rejects 2001 Unicode characters; missing entry cannot create feedback", async () => {
  const { journal } = await fixture();
  await db
    .insert(entries)
    .values({ journalId: journal.id, body: "😀".repeat(2000), entryDate: "2026-11-12" });
  await expect(
    db
      .insert(entries)
      .values({ journalId: journal.id, body: "😀".repeat(2001), entryDate: "2026-11-12" }),
  ).rejects.toThrow();
  await expect(beginFeedback(randomUUID(), "en")).rejects.toMatchObject({ reason: "validation" });
});

test("deleting before background processing prevents sending hidden text", async () => {
  const { entry } = await fixture();
  const job = await beginFeedback(entry.id, "en");
  await deleteEntry(entry.id, "soft");
  await runFeedback(job, feedbackStore, fake);
  expect(fake.generate).not.toHaveBeenCalled();
});

test("language refusal persists failure, costs one Jev call and releases the unused model slot", async () => {
  const { entry } = await fixture();
  const job = await beginFeedback(entry.id, "it");
  const allowed = await checkEntryLanguage(
    job.input.analysedText,
    job.input.language,
    job.entryId,
    {
      async judge(text, signal) {
        const raw = (await testJevClient.judge(text, signal)) as Record<string, unknown>;
        return {
          ...raw,
          text_kind: {
            type: "choice",
            choice: "encoded",
            confidence: 0.99,
            probabilities: {
              standard_language: 0.01,
              informal_language: 0,
              mixed: 0,
              encoded: 0.99,
              formula_or_numbers: 0,
              random: 0,
              other_language: 0,
            },
          },
        };
      },
    },
    jevStore,
  );
  if (!allowed) await refuseNonLanguageFeedback(job);
  else await runFeedback(job, feedbackStore, fake);
  expect(allowed).toBe(false);
  expect(fake.generate).not.toHaveBeenCalled();
  expect((await listFeedback(entry.id))[0]).toMatchObject({
    status: "failed",
    reason: "not_language_text",
    locale: "it",
  });
  expect(await db.select().from(modelCalls)).toEqual([]);
  const calls = await db.select().from(jevCalls).where(eq(jevCalls.entryId, entry.id));
  expect(calls).toHaveLength(1);
  expect(calls[0].confidence).toBe(0.99);
  expect(calls[0].answers).toMatchObject({ text_kind: { choice: "encoded" } });
  const [record] = await db.select().from(feedback).where(eq(feedback.id, job.id));
  expect(record.attempts).toBe(0);
});

test("a language refusal cannot erase a model call that has already started", async () => {
  const { entry } = await fixture();
  const job = await beginFeedback(entry.id, "en");
  await runFeedback(job, feedbackStore, fake);
  await refuseNonLanguageFeedback(job);
  expect((await listFeedback(entry.id))[0].status).toBe("ready");
  expect(await db.select().from(modelCalls)).toMatchObject([{ id: job.callId, outcome: "ready" }]);
});

test("failed repair persists public contract reason and attempt kinds", async () => {
  const { entry } = await fixture();
  const job = await beginFeedback(entry.id, "en");
  await runFeedback(job, feedbackStore, {
    generate: async () => ({ text: "{}", inputTokens: 1, outputTokens: 2 }),
  });
  expect((await listFeedback(entry.id))[0]).toMatchObject({
    status: "failed",
    reason: "invalid_output",
    corrections: [],
  });
  const calls = await db
    .select()
    .from(modelCalls)
    .where(and(eq(modelCalls.feedbackId, job.id), eq(modelCalls.outcome, "failed")))
    .orderBy(modelCalls.createdAt);
  expect(calls.map((c) => c.kind)).toEqual(["analysis", "repair"]);
  expect(calls.map((c) => c.reasonCode)).toEqual(["invalid_output", "invalid_output"]);
});
