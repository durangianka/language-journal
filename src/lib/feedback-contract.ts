// Portable mirror of the shared Stage 1 contract. Keep signatures aligned with contract.ts.
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
] = [
  "timeout",
  "provider_error",
  "invalid_output",
  "daily_cap_reached",
  "entry_limit_reached",
  "too_long",
];
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];
export const LIMITS = Object.freeze({
  entryMaxChars: 2000,
  entriesPerJournal: 10,
  feedbackPerEntry: 3,
  correctionsPerFeedback: 3,
  dailyModelCalls: 50,
  explanationMaxChars: 200,
});
export interface Correction {
  original: string;
  fix: string;
  category: FeedbackCategory;
  explanation: string;
}
export interface FeedbackDto {
  id: string;
  entryId: string;
  status: FeedbackStatus;
  reason: FeedbackReason | null;
  locale: Locale;
  correctedText: string | null;
  corrections: Correction[];
  createdAt: string;
}
export interface EntryDto {
  id: string;
  journalId: string;
  body: string;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
  latestFeedback: FeedbackDto | null;
}
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; reason: FeedbackReason | "validation" | "unknown" };
