// Shared contract for Stage 1. Every worker builds against this file.
// Change only with the owner's OK; add a note to the PR if you need a change.

export const LOCALES: readonly ["en", "es", "it"] = ["en", "es", "it"];
export type Locale = (typeof LOCALES)[number];

export const FEEDBACK_CATEGORIES: readonly ["grammar", "vocabulary", "spelling", "style"] = [
  "grammar",
  "vocabulary",
  "spelling",
  "style",
];
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_STATUSES: readonly ["pending", "ready", "failed"] = [
  "pending",
  "ready",
  "failed",
];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_REASONS: readonly [
  "timeout",
  "provider_error",
  "invalid_output",
  "daily_cap_reached",
  "entry_limit_reached",
  "too_long",
  "not_language_text",
] = [
  "timeout",
  "provider_error",
  "invalid_output",
  "daily_cap_reached",
  "entry_limit_reached",
  "too_long",
  "not_language_text",
];
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

export const LIMITS: {
  readonly entryMaxChars: 2000;
  readonly entriesPerJournal: 10;
  readonly feedbackPerEntry: 3;
  readonly correctionsPerFeedback: 3;
  readonly dailyModelCalls: 50;
  readonly explanationMaxChars: 200;
} = {
  entryMaxChars: 2000,
  entriesPerJournal: 10,
  feedbackPerEntry: 3,
  correctionsPerFeedback: 3,
  dailyModelCalls: 50,
  explanationMaxChars: 200,
};

export interface Correction {
  original: string; // exact text from the entry
  fix: string;
  category: FeedbackCategory;
  explanation: string; // in the locale of the feedback
}

export interface FeedbackDto {
  id: string;
  entryId: string;
  status: FeedbackStatus;
  reason: FeedbackReason | null;
  locale: Locale;
  correctedText: string | null;
  analysedText: string;
  corrections: Correction[];
  createdAt: string; // ISO
}

export interface EntryDto {
  id: string;
  journalId: string;
  body: string;
  entryDate: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  latestFeedback: FeedbackDto | null;
  latestSuccessfulFeedback: FeedbackDto | null;
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; reason: FeedbackReason | "validation" | "unknown" };

// Server actions (names are fixed; signatures are fixed)
// requestFeedback(entryId: string, locale: Locale): Promise<ActionResult<FeedbackDto>>
// deleteEntry(entryId: string, mode: "soft" | "hard"): Promise<ActionResult<null>>
// deleteJournal(journalId: string, mode: "soft" | "hard"): Promise<ActionResult<null>>
// listEntries(journalId: string): Promise<EntryDto[]>   // excludes soft-deleted
// getEntry(entryId: string): Promise<EntryDto | null>
