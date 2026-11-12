"use server";

import { getLocale } from "../../i18n/server";
import { summariseJournal } from "../../lib/insight/repository";
import type { SummaryResult } from "../../lib/insight/repository";
import { revalidatePath } from "next/cache";

export async function summariseJournalAction(journalId: string): Promise<SummaryResult> {
  try {
    const result = await summariseJournal(
      journalId,
      await getLocale(),
      process.env.FEEDBACK_TEST_MODE === "1"
        ? async () => ({
            text: "Practise verb agreement in your next entry.",
            inputTokens: 10,
            outputTokens: 10,
          })
        : undefined,
    );
    revalidatePath(`/journals/${journalId}`);
    return result;
  } catch {
    return { summary: null, reason: "failed" };
  }
}
