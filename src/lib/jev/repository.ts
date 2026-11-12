import "server-only";
import { count, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { jevCalls } from "../../db/schema";
import { jevQuestions } from "./contract";
import type { JevStore } from "./service";

export const jevStore: JevStore = {
  async reserve(entryId) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(6142802)`);
      const [row] = await tx.select({ total: count() }).from(jevCalls).where(sql`
        ${jevCalls.createdAt} >= (date_trunc('day', clock_timestamp() at time zone 'Europe/London') at time zone 'Europe/London')
        and ${jevCalls.createdAt} < ((date_trunc('day', clock_timestamp() at time zone 'Europe/London') + interval '1 day') at time zone 'Europe/London')
      `);
      if (row.total >= 200) return null;
      const [call] = await tx
        .insert(jevCalls)
        .values({ entryId, questions: jevQuestions })
        .returning();
      return call.id;
    });
  },
  async finish(id, answers, durationMs) {
    await db
      .update(jevCalls)
      .set({
        answers,
        confidence: answers?.main_issue.confidence ?? null,
        durationMs,
      })
      .where(eq(jevCalls.id, id));
  },
};
