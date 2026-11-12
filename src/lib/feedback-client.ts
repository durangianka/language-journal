// STUB ONLY. Replace these five contract calls with server actions when the backend lands.
// Feedback and deletion are browser-local simulations. No database rows are deleted.
import { z } from "zod";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_REASONS,
  FEEDBACK_STATUSES,
  LIMITS,
  LOCALES,
  type ActionResult,
  type Correction,
  type EntryDto,
  type FeedbackDto,
  type Locale,
} from "./feedback-contract";

export const STUB_STORAGE_KEY = "language-journal-feedback-stub-v1";
const changeEvent = "feedback-stub-change";
const feedbackSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  status: z.enum(FEEDBACK_STATUSES),
  reason: z.enum(FEEDBACK_REASONS).nullable(),
  locale: z.enum(LOCALES),
  correctedText: z.string().nullable(),
  createdAt: z.iso.datetime(),
  corrections: z.array(
    z.object({
      original: z.string(),
      fix: z.string(),
      category: z.enum(FEEDBACK_CATEGORIES),
      explanation: z.string(),
    }),
  ),
});
const stateSchema = z.object({
  feedback: z.record(z.string(), feedbackSchema),
  deletedEntries: z.record(z.string(), z.enum(["soft", "hard"])),
  deletedJournals: z.record(z.string(), z.enum(["soft", "hard"])),
});
export type StubState = z.infer<typeof stateSchema>;
const seeds = new Map<string, { entry: EntryDto; language: Locale }>();

export function parseStubState(raw: string): StubState {
  try {
    const value: unknown = JSON.parse(raw);
    const parsed = stateSchema.safeParse(value);
    if (parsed.success) return parsed.data;
  } catch {
    /* Invalid browser data falls back to the server-provided entries. */
  }
  return { feedback: {}, deletedEntries: {}, deletedJournals: {} };
}
export function getStubSnapshot(): string {
  try {
    return window.localStorage.getItem(STUB_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}
export function getServerStubSnapshot(): string {
  return "";
}
export function subscribeToStub(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changeEvent, callback);
  };
}
function save(state: StubState): boolean {
  try {
    window.localStorage.setItem(STUB_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event(changeEvent));
    return true;
  } catch {
    return false;
  }
}
export function seedEntries(entries: EntryDto[], language: Locale) {
  for (const entry of entries) seeds.set(entry.id, { entry, language });
}
export function visibleEntries(entries: EntryDto[], state: StubState): EntryDto[] {
  return entries
    .filter((entry) => !state.deletedEntries[entry.id] && !state.deletedJournals[entry.journalId])
    .map((entry) => ({
      ...entry,
      latestFeedback: state.feedback[entry.id] ?? entry.latestFeedback,
    }));
}
export async function listEntries(journalId: string): Promise<EntryDto[]> {
  return visibleEntries(
    Array.from(seeds.values(), ({ entry }) => entry).filter(
      (entry) => entry.journalId === journalId,
    ),
    parseStubState(getStubSnapshot()),
  );
}
export async function getEntry(entryId: string): Promise<EntryDto | null> {
  const seed = seeds.get(entryId);
  return seed ? (visibleEntries([seed.entry], parseStubState(getStubSnapshot()))[0] ?? null) : null;
}

const explanations = {
  en: "Use this verb form with this subject.",
  es: "Usa esta forma verbal con este sujeto.",
  it: "Usa questa forma del verbo con questo soggetto.",
};
const examples = {
  en: { original: "I goes", fix: "I go" },
  es: { original: "Yo va", fix: "Yo voy" },
  it: { original: "Io va", fix: "Io vado" },
};
export async function requestFeedback(
  entryId: string,
  locale: Locale,
): Promise<ActionResult<FeedbackDto>> {
  const entry = await getEntry(entryId);
  const seed = seeds.get(entryId);
  if (!entry || !seed) return { success: false, reason: "validation" };
  await new Promise((resolve) => setTimeout(resolve, 650));
  // Sample corrections only replace exact matching words in the learner's language.
  const example = examples[seed.language];
  const corrections: Correction[] = entry.body.includes(example.original)
    ? [{ ...example, category: "grammar", explanation: explanations[locale] }]
    : [];
  const reason = Array.from(entry.body).length > LIMITS.entryMaxChars ? "too_long" : null;
  const feedback: FeedbackDto = {
    id: crypto.randomUUID(),
    entryId,
    locale,
    reason,
    status: reason ? "failed" : "ready",
    correctedText: reason ? null : entry.body.replace(example.original, example.fix),
    corrections: reason ? [] : corrections,
    createdAt: new Date().toISOString(),
  };
  const state = parseStubState(getStubSnapshot());
  // An in-flight sample request must never resurrect a deleted entry.
  if (state.deletedEntries[entryId] || state.deletedJournals[entry.journalId])
    return { success: false, reason: "validation" };
  state.feedback[entryId] = feedback;
  return save(state) ? { success: true, data: feedback } : { success: false, reason: "unknown" };
}
export async function deleteEntry(
  entryId: string,
  mode: "soft" | "hard",
): Promise<ActionResult<null>> {
  const state = parseStubState(getStubSnapshot());
  state.deletedEntries[entryId] = mode;
  if (mode === "hard") delete state.feedback[entryId];
  return save(state) ? { success: true, data: null } : { success: false, reason: "unknown" };
}
export async function deleteJournal(
  journalId: string,
  mode: "soft" | "hard",
): Promise<ActionResult<null>> {
  const state = parseStubState(getStubSnapshot());
  state.deletedJournals[journalId] = mode;
  for (const { entry } of seeds.values()) {
    if (entry.journalId === journalId) {
      state.deletedEntries[entry.id] = mode;
      if (mode === "hard") delete state.feedback[entry.id];
    }
  }
  return save(state) ? { success: true, data: null } : { success: false, reason: "unknown" };
}
