import "server-only";
import { and, eq } from "drizzle-orm";
import type { db } from "../../db/client";
import { journalInsights, modelCalls } from "../../db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The caller holds the journal lock, shared with reservation and completion.
export async function invalidateJournalInsights(tx: Transaction, journalId: string) {
  // Keep the daily reservation and metering, but remove all derived source text.
  await tx
    .update(journalInsights)
    .set({ summary: null })
    .where(eq(journalInsights.journalId, journalId));
  // A running call is also its completion permit. Revoking it rejects stale output,
  // even if the source is subsequently restored or edited back to its old value.
  await tx
    .update(modelCalls)
    .set({ outcome: "failed", reasonCode: "provider_error" })
    .where(
      and(
        eq(modelCalls.journalId, journalId),
        eq(modelCalls.kind, "insight"),
        eq(modelCalls.outcome, "running"),
      ),
    );
}
