"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import {
  beginFeedback,
  FeedbackRequestError,
  feedbackStore,
  latestFeedback,
} from "../../lib/ai/repository";
import { openAIProvider } from "../../lib/ai/openai";
import { runFeedback } from "../../lib/ai/service";
import { idSchema } from "../../lib/journal/schemas";
import { localeSchema } from "../../config/locales";
import type { ActionResult, EntryDto, FeedbackDto, Locale } from "../../lib/feedback-contract";
import {
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
    after(async () => {
      await runFeedback(job, feedbackStore, openAIProvider);
      revalidatePath(`/journals/${job.journalId}`);
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
