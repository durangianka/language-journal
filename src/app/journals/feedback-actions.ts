"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import {
  beginFeedback,
  FeedbackRequestError,
  feedbackStore,
  latestFeedback,
  refuseNonLanguageFeedback,
} from "../../lib/ai/repository";
import { openAIProvider } from "../../lib/ai/sdk";
import { testFeedbackProvider } from "../../lib/ai/test-provider";
import { runFeedback } from "../../lib/ai/service";
import { checkEntryLanguage } from "../../lib/jev/service";
import { jevClient } from "../../lib/jev/client";
import { testJevClient } from "../../lib/jev/test-client";
import { jevStore } from "../../lib/jev/repository";
import { idSchema } from "../../lib/journal/schemas";
import { localeSchema } from "../../config/locales";
import { emptyTrash } from "../../lib/journal/trash";
import type { ActionResult, EntryDto, FeedbackDto, Locale } from "../../lib/feedback-contract";
import {
  restoreDeleted,
  deleteEntry as removeEntry,
  deleteJournal as removeJournal,
  getEntry as readEntry,
  listEntries as readEntries,
} from "../../lib/journal";

export async function requestFeedback(
  entryId: string,
  locale: Locale,
): Promise<ActionResult<FeedbackDto>> {
  if (!idSchema.safeParse(entryId).success || !localeSchema.safeParse(locale).success)
    return { success: false, reason: "validation" };
  try {
    // Only persisted text can be analysed. The caller supplies its current interface locale.
    const job = await beginFeedback(entryId, locale);
    revalidatePath("/journals", "layout");
    after(async () => {
      // Preserve deletion privacy before sending the snapshot to Jev as well as the model.
      if (!(await readEntry(job.entryId))) return;
      const allowed = await checkEntryLanguage(
        job.input.analysedText,
        job.input.language,
        job.entryId,
        process.env.JEV_TEST_MODE === "1" ? testJevClient : jevClient,
        jevStore,
      );
      if (!allowed) await refuseNonLanguageFeedback(job);
      else
        await runFeedback(
          job,
          feedbackStore,
          process.env.FEEDBACK_TEST_MODE === "1" ? testFeedbackProvider : openAIProvider,
        );
      revalidatePath("/journals", "layout");
    });
    return { success: true, data: job.feedback };
  } catch (error) {
    return {
      success: false,
      reason: error instanceof FeedbackRequestError ? error.reason : "unknown",
    };
  }
}

export async function getFeedbackStateAction(entryId: string): Promise<FeedbackDto | null> {
  if (!idSchema.safeParse(entryId).success) return null;
  return latestFeedback(entryId);
}

export async function deleteEntry(
  entryId: string,
  mode: "soft" | "hard",
): Promise<ActionResult<null>> {
  if (!idSchema.safeParse(entryId).success || !["soft", "hard"].includes(mode))
    return { success: false, reason: "validation" };
  try {
    await removeEntry(entryId, mode);
    revalidatePath("/journals", "layout");
    return { success: true, data: null };
  } catch {
    return { success: false, reason: "unknown" };
  }
}

export async function deleteJournal(
  journalId: string,
  mode: "soft" | "hard",
): Promise<ActionResult<null>> {
  if (!idSchema.safeParse(journalId).success || !["soft", "hard"].includes(mode))
    return { success: false, reason: "validation" };
  try {
    await removeJournal(journalId, mode);
    revalidatePath("/journals", "layout");
    return { success: true, data: null };
  } catch {
    return { success: false, reason: "unknown" };
  }
}

export async function listEntries(journalId: string): Promise<EntryDto[]> {
  return readEntries(journalId);
}
export async function getEntry(entryId: string): Promise<EntryDto | null> {
  return readEntry(entryId);
}

export async function restoreDeletedAction(
  id: string,
  kind: "entry" | "journal",
): Promise<ActionResult<null>> {
  if (!idSchema.safeParse(id).success || !["entry", "journal"].includes(kind))
    return { success: false, reason: "validation" };
  try {
    await restoreDeleted(id, kind);
    revalidatePath("/journals", "layout");
    return { success: true, data: null };
  } catch {
    return { success: false, reason: "unknown" };
  }
}

export async function emptyTrashAction(): Promise<ActionResult<null>> {
  try {
    await emptyTrash();
    revalidatePath("/journals", "layout");
    revalidatePath("/trash");
    return { success: true, data: null };
  } catch {
    return { success: false, reason: "unknown" };
  }
}
