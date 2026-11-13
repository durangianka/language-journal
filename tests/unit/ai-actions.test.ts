import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/ai/repository", () => ({
  beginFeedback: vi.fn(),
  feedbackStore: { failed: vi.fn() },
  latestFeedback: vi.fn(),
  refuseNonLanguageFeedback: vi.fn(),
  FeedbackRequestError: class extends Error {
    constructor(public reason: string) {
      super(reason);
    }
  },
}));
vi.mock("../../src/lib/ai/sdk", () => ({ openAIProvider: {} }));
vi.mock("../../src/lib/ai/service", () => ({ runFeedback: vi.fn() }));
vi.mock("../../src/lib/jev/client", () => ({ jevClient: { judge: vi.fn() } }));
vi.mock("../../src/lib/jev/repository", () => ({
  jevStore: { reserve: vi.fn(), finish: vi.fn() },
}));
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
import {
  beginFeedback,
  FeedbackRequestError,
  refuseNonLanguageFeedback,
  feedbackStore,
} from "../../src/lib/ai/repository";
import { jevClient } from "../../src/lib/jev/client";
import { jevStore } from "../../src/lib/jev/repository";
import { testJevClient } from "../../src/lib/jev/test-client";
import { jevTimeoutMs } from "../../src/lib/jev/service";
import { runFeedback } from "../../src/lib/ai/service";
import { deleteEntry as removeEntry, getEntry as readEntry } from "../../src/lib/journal";
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
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.stubEnv("JEV_TEST_MODE", "0");
  vi.mocked(jevStore.reserve).mockResolvedValue("jev-call");
  vi.mocked(jevStore.finish).mockResolvedValue();
  vi.mocked(readEntry).mockResolvedValue({
    id,
    journalId: id,
    body: "A = 2 + B = 75",
    entryDate: "2026-11-12",
    createdAt: "2026-11-12T00:00:00Z",
    updatedAt: "2026-11-12T00:00:00Z",
    latestFeedback: null,
    latestSuccessfulFeedback: null,
  });
});

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
    analysedText: "Ciao",
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

async function backgroundFeedback() {
  vi.mocked(beginFeedback).mockResolvedValue({
    id,
    entryId: id,
    journalId: id,
    callId: id,
    feedback: {
      id,
      entryId: id,
      status: "pending",
      locale: "it",
      reason: null,
      correctedText: null,
      analysedText: "A = 2 + B = 75",
      corrections: [],
      createdAt: "2026-11-12T00:00:00Z",
    },
    input: {
      analysedText: "A = 2 + B = 75",
      language: "es",
      level: "new",
      locale: "it",
      focus: [],
    },
  });
  await request(id, "it");
  const callback = vi.mocked(after).mock.calls[0][0];
  if (typeof callback !== "function") throw new Error("Expected after callback");
  return callback();
}

test.each([
  ["standard_language", 0.7, true],
  ["standard_language", 0.2, true],
  ["informal_language", 0.99, true],
  ["informal_language", 0.2, true],
  ["mixed", 0.99, true],
  ["mixed", 0.2, true],
  ["formula_or_numbers", 0.99, false],
  ["encoded", 0.99, false],
  ["random", 0.99, false],
  ["other_language", 0.99, false],
  ["random", 0.2, false],
] as const)(
  "feedback gate: %s confidence %s allows model: %s",
  async (choice, confidence, allowed) => {
    const raw = (await testJevClient.judge("", new AbortController().signal)) as Record<
      string,
      unknown
    >;
    vi.mocked(jevClient.judge).mockResolvedValue({
      ...raw,
      text_kind: {
        type: "choice",
        choice,
        confidence,
        probabilities: {
          standard_language: 0.4,
          informal_language: 0.1,
          mixed: 0.1,
          formula_or_numbers: 0.1,
          encoded: 0.1,
          random: 0.1,
          other_language: 0.1,
        },
      },
    });
    await backgroundFeedback();
    expect(jevClient.judge).toHaveBeenCalledWith(
      "A = 2 + B = 75",
      expect.any(AbortSignal),
      expect.objectContaining({
        text_kind: expect.objectContaining({ instructions: expect.stringContaining("es") }),
      }),
    );
    expect(jevStore.reserve).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ text_kind: expect.any(Object) }),
    );
    expect(jevStore.finish).toHaveBeenCalledWith(
      "jev-call",
      expect.objectContaining({ text_kind: expect.objectContaining({ choice }) }),
      expect.any(Number),
    );
    expect(runFeedback).toHaveBeenCalledTimes(allowed ? 1 : 0);
    expect(refuseNonLanguageFeedback).toHaveBeenCalledTimes(allowed ? 0 : 1);
  },
);

test.each(["failure", "malformed", "cap"])("Jev %s fails open", async (mode) => {
  if (mode === "failure") vi.mocked(jevClient.judge).mockRejectedValue(new Error("unavailable"));
  if (mode === "malformed") vi.mocked(jevClient.judge).mockResolvedValue({});
  if (mode === "cap") vi.mocked(jevStore.reserve).mockResolvedValue(null);
  await backgroundFeedback();
  expect(runFeedback).toHaveBeenCalledOnce();
  expect(refuseNonLanguageFeedback).not.toHaveBeenCalled();
  if (mode === "cap") expect(jevClient.judge).not.toHaveBeenCalled();
  else expect(jevStore.finish).toHaveBeenCalledWith("jev-call", null, expect.any(Number));
});

test("Jev timeout aborts, logs and proceeds to feedback", async () => {
  vi.useFakeTimers();
  vi.mocked(jevClient.judge).mockImplementation(() => new Promise(() => {}));
  const work = backgroundFeedback();
  await vi.advanceTimersByTimeAsync(jevTimeoutMs);
  await work;
  expect(vi.mocked(jevClient.judge).mock.calls[0][1].aborted).toBe(true);
  expect(jevStore.finish).toHaveBeenCalledWith("jev-call", null, jevTimeoutMs);
  expect(runFeedback).toHaveBeenCalledOnce();
  expect(refuseNonLanguageFeedback).not.toHaveBeenCalled();
  vi.useRealTimers();
});

test("deleting before background work prevents sending text to Jev or the model", async () => {
  vi.mocked(readEntry).mockResolvedValue(null);
  await backgroundFeedback();
  expect(jevClient.judge).not.toHaveBeenCalled();
  expect(runFeedback).not.toHaveBeenCalled();
  expect(feedbackStore.failed).toHaveBeenCalledWith(id, "provider_error");
});

test("a failed initial background read settles the committed feedback job", async () => {
  vi.mocked(readEntry).mockRejectedValue(new Error("Database temporarily unavailable"));
  await expect(backgroundFeedback()).resolves.toBeUndefined();
  expect(feedbackStore.failed).toHaveBeenCalledWith(id, "provider_error");
  expect(runFeedback).not.toHaveBeenCalled();
});
