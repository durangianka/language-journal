import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { entries, journalInsights, journals, modelCalls } from "../../db/schema";
import { idSchema } from "../journal/schemas";
import { localeSchema, type Locale } from "../../config/locales";
import { hasDailyRoom } from "../ai/repository";
import { summaryProvider, type SummaryProvider } from "./provider";

export type SummaryResult = { summary: string | null; reason?: "daily" | "empty" | "failed" };

export async function getTodayInsight(journalId: string, locale: Locale) {
  const [record] = await db
    .select({ summary: journalInsights.summary })
    .from(journalInsights)
    .innerJoin(journals, eq(journals.id, journalInsights.journalId))
    .where(
      and(
        eq(journalInsights.journalId, idSchema.parse(journalId)),
        eq(journalInsights.locale, locale),
        isNull(journals.deletedAt),
        sql`${journalInsights.day} = (clock_timestamp() at time zone 'Europe/London')::date`,
      ),
    );
  return record?.summary ?? null;
}

export async function summariseJournal(
  journalId: string,
  locale: Locale,
  provider: SummaryProvider = summaryProvider,
): Promise<SummaryResult> {
  idSchema.parse(journalId);
  localeSchema.parse(locale);
  type Reservation = { callId: string; insightId: string; source: string[] } | SummaryResult;
  const reservation = await db.transaction<Reservation>(async (tx) => {
    const [journal] = await tx
      .select()
      .from(journals)
      .where(and(eq(journals.id, journalId), isNull(journals.deletedAt)))
      .for("update");
    if (!journal) return { summary: null, reason: "empty" };
    const [existing] = await tx
      .select()
      .from(journalInsights)
      .where(
        and(
          eq(journalInsights.journalId, journalId),
          sql`${journalInsights.day} = (clock_timestamp() at time zone 'Europe/London')::date`,
        ),
      );
    if (existing)
      return { summary: existing.locale === locale ? existing.summary : null, reason: "daily" };
    const source = await tx
      .select({ body: entries.body })
      .from(entries)
      .where(and(eq(entries.journalId, journalId), isNull(entries.deletedAt)))
      .orderBy(desc(entries.entryDate), desc(entries.createdAt), desc(entries.id))
      .limit(10);
    if (!source.length) return { summary: null, reason: "empty" };
    if (!(await hasDailyRoom(tx))) return { summary: null, reason: "daily" };
    const [call] = await tx
      .insert(modelCalls)
      .values({ journalId, kind: "insight", outcome: "running" })
      .returning();
    const [insight] = await tx
      .insert(journalInsights)
      .values({
        journalId,
        locale,
        callId: call.id,
        day: sql`(clock_timestamp() at time zone 'Europe/London')::date`,
      })
      .returning();
    return { callId: call.id, insightId: insight.id, source: source.map((e) => e.body) };
  });
  if (!("callId" in reservation)) return reservation;
  const start = Date.now();
  try {
    const result = await provider({ entries: reservation.source, locale });
    await db.transaction(async (tx) => {
      const [journal] = await tx
        .select()
        .from(journals)
        .where(eq(journals.id, journalId))
        .for("update");
      if (!journal || journal.deletedAt) throw new Error("Journal unavailable");
      const permitted = await tx
        .update(modelCalls)
        .set({
          outcome: "ready",
          durationMs: Date.now() - start,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        })
        .where(and(eq(modelCalls.id, reservation.callId), eq(modelCalls.outcome, "running")))
        .returning({ id: modelCalls.id });
      if (!permitted.length) throw new Error("Summary source changed");
      await tx
        .update(journalInsights)
        .set({ summary: result.text })
        .where(eq(journalInsights.id, reservation.insightId));
    });
    return { summary: result.text };
  } catch {
    await db
      .update(modelCalls)
      .set({ outcome: "failed", reasonCode: "provider_error", durationMs: Date.now() - start })
      .where(eq(modelCalls.id, reservation.callId));
    return { summary: null, reason: "failed" };
  }
}
