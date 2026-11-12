import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/ai/repository", () => ({
  beginFeedback: vi.fn(),
  feedbackStore: {},
  latestFeedback: vi.fn(),
  FeedbackRequestError: class extends Error {
    constructor(public reason: string) {
      super(reason);
    }
  },
}));
vi.mock("../../src/lib/ai/openai", () => ({ openAIProvider: {} }));
vi.mock("../../src/lib/ai/service", () => ({ runFeedback: vi.fn() }));
vi.mock("../../src/lib/journal", () => ({
  deleteEntry: vi.fn(),
  deleteJournal: vi.fn(),
  getEntry: vi.fn(),
  listEntries: vi.fn(),
}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { after } from "next/server";
import {
  requestFeedback,
  deleteEntry,
  deleteJournal,
  listEntries,
  getEntry,
} from "../../src/app/journals/feedback-actions";
import { beginFeedback, FeedbackRequestError } from "../../src/lib/ai/repository";
import { runFeedback } from "../../src/lib/ai/service";
import { deleteEntry as removeEntry } from "../../src/lib/journal";
import type { ActionResult, EntryDto, FeedbackDto, Locale } from "../../src/lib/feedback-contract";

// Compile-time conformance to the owner's fixed action signatures.
const request: (entryId: string, locale: Locale) => Promise<ActionResult<FeedbackDto>> =
  requestFeedback;
const remove: (entryId: string, mode: "soft" | "hard") => Promise<ActionResult<null>> = deleteEntry;
const removeJournal: (journalId: string, mode: "soft" | "hard") => Promise<ActionResult<null>> =
  deleteJournal;
const list: (journalId: string) => Promise<EntryDto[]> = listEntries;
const get: (entryId: string) => Promise<EntryDto | null> = getEntry;
const id = "a898dc71-df35-425f-9ed1-6e79019cb1e7";
beforeEach(() => vi.resetAllMocks());

test("invalid IDs do not write, schedule or call the provider", async () => {
  expect(await request("bad", "en")).toEqual({ success: false, reason: "validation" });
  expect(beginFeedback).not.toHaveBeenCalled();
  expect(after).not.toHaveBeenCalled();
  expect(runFeedback).not.toHaveBeenCalled();
});
test("returns the committed pending DTO before background work begins", async () => {
  const pending: FeedbackDto = {
    id,
    entryId: id,
    status: "pending",
    locale: "it",
    reason: null,
    correctedText: null,
    corrections: [],
    createdAt: "2026-11-12T00:00:00Z",
  };
  vi.mocked(beginFeedback).mockResolvedValue({
    id,
    entryId: id,
    journalId: id,
    callId: id,
    feedback: pending,
    input: { analysedText: "Ciao", language: "it", level: "new", locale: "it", focus: [] },
  });
  expect(await request(id, "it")).toEqual({ success: true, data: pending });
  expect(beginFeedback).toHaveBeenCalledWith(id, "it");
  expect(after).toHaveBeenCalledOnce();
  expect(runFeedback).not.toHaveBeenCalled();
});
test.each(["daily_cap_reached", "entry_limit_reached", "too_long"] as const)(
  "returns contract refusal %s",
  async (reason) => {
    vi.mocked(beginFeedback).mockRejectedValue(new FeedbackRequestError(reason));
    expect(await request(id, "es")).toEqual({ success: false, reason });
    expect(after).not.toHaveBeenCalled();
  },
);
test("delete modes are validated and soft deletion is explicit", async () => {
  expect(await remove("bad", "hard")).toEqual({ success: false, reason: "validation" });
  expect(await remove(id, "soft")).toEqual({ success: true, data: null });
  expect(removeEntry).toHaveBeenCalledWith(id, "soft");
  expect(await removeJournal(id, "hard")).toEqual({ success: true, data: null });
  expect(typeof list).toBe("function");
  expect(typeof get).toBe("function");
});
