import { expect, test, vi } from "vitest";
vi.mock("../../src/app/journals/feedback-actions", () => ({
  requestFeedback: vi.fn(),
  deleteEntry: vi.fn(),
  deleteJournal: vi.fn(),
  listEntries: vi.fn(),
  getEntry: vi.fn(),
}));
import * as server from "../../src/app/journals/feedback-actions";
import * as client from "../../src/lib/feedback-client";
import { feedbackResultState, feedbackScreenState } from "../../src/lib/feedback-state";
import {
  FEEDBACK_REASONS,
  FEEDBACK_STATUSES,
  type FeedbackDto,
} from "../../src/lib/feedback-contract";
import { dictionaries } from "../../src/i18n/dictionaries";

const ready: FeedbackDto = {
  id: "feedback",
  entryId: "entry",
  status: "ready",
  reason: null,
  locale: "en",
  correctedText: "I go to school.",
  corrections: [],
  createdAt: "2026-11-12T12:00:00Z",
};

test("all five client contract calls are real server references", () => {
  for (const name of [
    "requestFeedback",
    "deleteEntry",
    "deleteJournal",
    "listEntries",
    "getEntry",
  ] as const)
    expect(client[name]).toBe(server[name]);
});
test("no saved feedback maps to the initial screen", () => {
  expect(feedbackScreenState(null)).toEqual({ feedback: null, status: null, reason: null });
});
test.each(FEEDBACK_STATUSES)("server %s DTO maps to its screen", (status) => {
  const data = { ...ready, status, reason: status === "failed" ? ("timeout" as const) : null };
  expect(feedbackResultState({ success: true, data }, null)).toEqual({
    feedback: data,
    status,
    reason: data.reason,
  });
});
test("in-flight request shows pending over previous ready feedback", () => {
  expect(feedbackScreenState(ready, true)).toMatchObject({ status: "pending", feedback: ready });
});
test.each([...FEEDBACK_REASONS, "validation", "unknown"] as const)(
  "server refusal %s becomes a failed screen without losing the last DTO",
  (reason) => {
    expect(feedbackResultState({ success: false, reason }, ready)).toEqual({
      feedback: ready,
      status: "failed",
      reason,
    });
  },
);
test.each(["en", "es", "it"] as const)("every server reason has screen copy in %s", (locale) => {
  for (const reason of FEEDBACK_REASONS)
    expect(dictionaries[locale][reason].length).toBeGreaterThan(0);
});
