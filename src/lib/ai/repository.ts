import "server-only";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { entries, feedback, journalMistakeCounts, journals, modelCalls } from "../../db/schema";
import { localeSchema, type Locale } from "../../config/locales";
import { createJournalSchema, idSchema } from "../journal/schemas";
import { model } from "./provider";
import { promptVersion } from "./prompt";
import type { FeedbackJob, FeedbackStore } from "./service";
import { dailyCallCap, requestLimit } from "./limits";
import { LIMITS, type FeedbackDto, type FeedbackReason } from "../feedback-contract";

export class FeedbackRequestError extends Error {
  constructor(public readonly reason: FeedbackReason | "validation") {
    super(reason);
  }
}
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Serialize reservations across all app processes. No network I/O holds this lock.
async function hasDailyRoom(tx: Transaction) {
  await tx.execute(sql`select pg_advisory_xact_lock(6142801)`);
  const [row] = await tx.select({ total: count() }).from(modelCalls).where(sql`
    ${modelCalls.createdAt} >= (date_trunc('day', clock_timestamp() at time zone 'Europe/London') at time zone 'Europe/London')
    and ${modelCalls.createdAt} < ((date_trunc('day', clock_timestamp() at time zone 'Europe/London') + interval '1 day') at time zone 'Europe/London')
  `);
  return row.total < dailyCallCap;
}

export function toFeedbackDto(row: typeof feedback.$inferSelect): FeedbackDto {
  return {
    id: row.id,
    entryId: row.entryId,
    status: row.status,
    reason: row.reasonCode,
    locale: row.locale,
    correctedText: row.correctedText,
    corrections: row.corrections ?? [],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function beginFeedback(
  entryId: string,
  locale: Locale,
): Promise<FeedbackJob & { feedback: FeedbackDto }> {
  idSchema.parse(entryId);
  localeSchema.parse(locale);
  return db.transaction(async (tx) => {
    const [source] = await tx
      .select({ journalId: entries.journalId })
      .from(entries)
      .where(eq(entries.id, entryId));
    if (!source) throw new FeedbackRequestError("validation");
    const [journal] = await tx
      .select()
      .from(journals)
      .where(and(eq(journals.id, source.journalId), isNull(journals.deletedAt)))
      .for("update");
    const [entry] = await tx
      .select()
      .from(entries)
      .where(and(eq(entries.id, entryId), isNull(entries.deletedAt)))
      .for("update");
    if (!journal || !entry) throw new FeedbackRequestError("validation");
    const profile = createJournalSchema.parse({
      language: journal.language,
      level: journal.level,
      focus: journal.focus,
    });
    if (Array.from(entry.body).length > LIMITS.entryMaxChars)
      throw new FeedbackRequestError("too_long");
    const [requests] = await tx
      .select({ total: count() })
      .from(feedback)
      .where(eq(feedback.entryId, entryId));
    if (requestLimit(requests.total, 0)) throw new FeedbackRequestError("entry_limit_reached");
    if (!(await hasDailyRoom(tx))) throw new FeedbackRequestError("daily_cap_reached");
    const [record] = await tx
      .insert(feedback)
      .values({ entryId, analysedText: entry.body, locale, model, promptVersion, attempts: 1 })
      .returning();
    const [call] = await tx
      .insert(modelCalls)
      .values({ feedbackId: record.id, entryId, kind: "analysis", outcome: "reserved" })
      .returning();
    return {
      id: record.id,
      entryId,
      journalId: journal.id,
      callId: call.id,
      feedback: toFeedbackDto(record),
      input: { analysedText: entry.body, locale, ...profile },
    };
  });
}

export const feedbackStore: FeedbackStore = {
  async claim(callId) {
    const rows = await db
      .update(modelCalls)
      .set({ outcome: "running" })
      .where(
        and(
          eq(modelCalls.id, callId),
          eq(modelCalls.outcome, "reserved"),
          sql`exists (
      select 1 from ${entries} inner join ${journals} on ${entries.journalId} = ${journals.id}
      where ${entries.id} = ${modelCalls.entryId} and ${entries.deletedAt} is null and ${journals.deletedAt} is null
    )`,
        ),
      )
      .returning({ id: modelCalls.id });
    return rows.length === 1;
  },
  async reserve(job, kind) {
    return db.transaction(async (tx) => {
      const [record] = await tx
        .select()
        .from(feedback)
        .where(and(eq(feedback.id, job.id), eq(feedback.status, "pending")))
        .for("update");
      if (!record || record.attempts >= 3 || !(await hasDailyRoom(tx))) return null;
      const [call] = await tx
        .insert(modelCalls)
        .values({ feedbackId: job.id, entryId: job.entryId, kind, outcome: "reserved" })
        .returning();
      await tx
        .update(feedback)
        .set({ attempts: record.attempts + 1, updatedAt: new Date() })
        .where(eq(feedback.id, job.id));
      return call.id;
    });
  },
  async log(callId, log) {
    await db.update(modelCalls).set(log).where(eq(modelCalls.id, callId));
  },
  async ready(job, output) {
    await db.transaction(async (tx) => {
      // Same lock order as deletion, so counters cannot race with hard deletion.
      await tx
        .select({ id: journals.id })
        .from(journals)
        .where(eq(journals.id, job.journalId))
        .for("update");
      const rows = await tx
        .update(feedback)
        .set({
          status: "ready",
          correctedText: output.corrected_text,
          corrections: output.corrections,
          reasonCode: null,
          updatedAt: new Date(),
        })
        .where(and(eq(feedback.id, job.id), eq(feedback.status, "pending")))
        .returning({ id: feedback.id });
      if (!rows.length) return;
      for (const correction of output.corrections) {
        await tx
          .insert(journalMistakeCounts)
          .values({ journalId: job.journalId, category: correction.category, count: 1 })
          .onConflictDoUpdate({
            target: [journalMistakeCounts.journalId, journalMistakeCounts.category],
            set: { count: sql`${journalMistakeCounts.count} + 1` },
          });
      }
    });
  },
  async failed(id, reason) {
    await db
      .update(feedback)
      .set({ status: "failed", reasonCode: reason, updatedAt: new Date() })
      .where(and(eq(feedback.id, id), eq(feedback.status, "pending")));
  },
};

export async function listFeedback(entryId: string) {
  idSchema.parse(entryId);
  const rows = await db
    .select({ feedback })
    .from(feedback)
    .innerJoin(entries, eq(feedback.entryId, entries.id))
    .innerJoin(journals, eq(entries.journalId, journals.id))
    .where(and(eq(entries.id, entryId), isNull(entries.deletedAt), isNull(journals.deletedAt)))
    .orderBy(desc(feedback.createdAt), desc(feedback.id));
  return rows.map(({ feedback: row }) => toFeedbackDto(row));
}

export async function latestFeedback(entryId: string) {
  return (await listFeedback(entryId))[0] ?? null;
}

export async function latestFeedbackForEntries(entryIds: string[]) {
  const result = new Map<string, FeedbackDto>();
  if (!entryIds.length) return result;
  const rows = await db
    .select({ feedback })
    .from(feedback)
    .innerJoin(entries, eq(feedback.entryId, entries.id))
    .innerJoin(journals, eq(entries.journalId, journals.id))
    .where(
      and(inArray(entries.id, entryIds), isNull(entries.deletedAt), isNull(journals.deletedAt)),
    )
    .orderBy(desc(feedback.createdAt), desc(feedback.id));
  for (const { feedback: row } of rows)
    if (!result.has(row.entryId)) result.set(row.entryId, toFeedbackDto(row));
  return result;
}
