import { afterAll, afterEach, expect, test, vi } from "vitest";
import { count, eq, sql } from "drizzle-orm";
vi.mock("server-only", () => ({}));
import { client, db } from "../../src/db/client";
import {
  entries,
  feedback,
  jevCalls,
  journalInsights,
  journals,
  modelCalls,
} from "../../src/db/schema";
import { createEntry, createJournal, deleteEntry, deleteJournal } from "../../src/lib/journal";
import { beginFeedback, feedbackStore } from "../../src/lib/ai/repository";
import { runFeedback } from "../../src/lib/ai/service";
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
  await db.delete(modelCalls);
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
  await db.insert(modelCalls).values(
    Array.from(
      { length: 50 },
      () =>
        ({
          journalId: journal.id,
          kind: "insight",
          outcome: "ready",
        }) satisfies typeof modelCalls.$inferInsert,
    ),
  );
  const provider = vi.fn();
  expect(await summariseJournal(journal.id, "en", provider)).toEqual({
    summary: null,
    reason: "daily",
  });
  expect(provider).not.toHaveBeenCalled();
  expect(entry.id).toBeTruthy();
});
test.each(["journal", "entry", "feedback"])(
  "hard deleting a %s preserves the exhausted daily cap for summaries and feedback",
  async (source) => {
    const { journal, entry } = await fixture();
    const target = await fixture();
    await db.insert(modelCalls).values(
      Array.from(
        { length: 48 },
        () =>
          ({
            journalId: journal.id,
            kind: "insight",
            outcome: "ready",
          }) satisfies typeof modelCalls.$inferInsert,
      ),
    );
    const summaryProvider = vi.fn(async () => ({
      text: "Keep practising your past tense.",
      inputTokens: 10,
      outputTokens: 5,
    }));
    expect(await summariseJournal(journal.id, "en", summaryProvider)).toEqual({
      summary: "Keep practising your past tense.",
    });
    const job = await beginFeedback(entry.id, "en");
    const feedbackProvider = {
      generate: vi.fn(async () => ({
        text: JSON.stringify({ corrected_text: entry.body, corrections: [] }),
        inputTokens: 20,
        outputTokens: 10,
      })),
    };
    await runFeedback(job, feedbackStore, feedbackProvider);
    expect(summaryProvider).toHaveBeenCalledTimes(1);
    expect(feedbackProvider.generate).toHaveBeenCalledTimes(1);
    const before = await db.select().from(modelCalls).orderBy(modelCalls.id);
    expect(before).toHaveLength(50);
    expect(before.find((call) => call.id === job.callId)?.outcome).toBe("ready");

    if (source === "journal") await deleteJournal(journal.id, "hard");
    else if (source === "entry") await deleteEntry(entry.id, "hard");
    else await db.delete(feedback).where(eq(feedback.id, job.id));

    const after = await db.select().from(modelCalls).orderBy(modelCalls.id);
    expect(after).toEqual(
      before.map((call) => ({
        ...call,
        journalId: source === "journal" ? null : call.journalId,
        entryId: source === "journal" || source === "entry" ? null : call.entryId,
        feedbackId: null,
      })),
    );
    expect(await summariseJournal(target.journal.id, "en", summaryProvider)).toEqual({
      summary: null,
      reason: "daily",
    });
    await expect(beginFeedback(target.entry.id, "en")).rejects.toMatchObject({
      reason: "daily_cap_reached",
    });
    expect(summaryProvider).toHaveBeenCalledTimes(1);
    expect(feedbackProvider.generate).toHaveBeenCalledTimes(1);
    expect(await db.select({ total: count() }).from(modelCalls)).toEqual([{ total: 50 }]);
  },
);

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
