"use server";

import { revalidatePath } from "next/cache";
import { createEntry, createJournal, getJournal } from "../../lib/journal";
import {
  mapIssues,
  parseEntryForm,
  parseJournalForm,
  type ActionResult,
} from "../../lib/journal/action-input";

export async function createJournalAction(form: FormData): Promise<ActionResult> {
  const parsed = parseJournalForm(form);
  if (!parsed.success) return mapIssues(parsed.error.issues);
  try {
    const journal = await createJournal(parsed.data);
    revalidatePath("/journals");
    return { success: true, id: journal.id };
  } catch {
    return { success: false, errors: { form: "saveFailed" } };
  }
}

export async function createEntryAction(form: FormData): Promise<ActionResult> {
  const parsed = parseEntryForm(form);
  if (!parsed.success) return mapIssues(parsed.error.issues);
  try {
    if (!(await getJournal(parsed.data.journalId))) {
      return { success: false, errors: { journalId: "invalidJournal" } };
    }
    const entry = await createEntry(parsed.data);
    revalidatePath(`/journals/${entry.journalId}`);
    return { success: true, id: entry.id };
  } catch {
    return { success: false, errors: { form: "saveFailed" } };
  }
}
