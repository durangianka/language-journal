import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createFeedbackProvider, openAIProvider } from "../../src/lib/ai/sdk";
import { runFeedback, type FeedbackJob, type FeedbackStore } from "../../src/lib/ai/service";

const good = { corrected_text: "Hello", corrections: [] };
const job: FeedbackJob = {
  id: "feedback",
  entryId: "entry",
  journalId: "journal",
  callId: "initial",
  input: { analysedText: "Hello", language: "en", level: "basic", locale: "en", focus: [] },
};
const response = (text = JSON.stringify(good)) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: undefined },
  usage: {
    inputTokens: { total: 7, noCache: 7, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 8, text: 8, reasoning: undefined },
  },
  warnings: [],
});
function failure(status: number | undefined, isRetryable = status === undefined || status >= 500) {
  return new APICallError({
    message: "Fake provider failure",
    url: "https://fake.invalid",
    requestBodyValues: {},
    statusCode: status,
    isRetryable,
    responseHeaders: { "retry-after-ms": "1" },
  });
}
function store() {
  return {
    claim: vi.fn().mockResolvedValue(true),
    reserve: vi.fn<FeedbackStore["reserve"]>().mockImplementation(async (_job, kind) => kind),
    log: vi.fn(),
    ready: vi.fn(),
    failed: vi.fn(),
  } satisfies FeedbackStore;
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

test("real SDK uses the Zod structured schema, prompt and private Responses options", async () => {
  const model = new MockLanguageModelV4({ doGenerate: response() });
  const provider = createFeedbackProvider(model);
  expect(await provider.generate(job.input, new AbortController().signal)).toEqual({
    text: JSON.stringify(good),
    inputTokens: 7,
    outputTokens: 8,
  });
  expect(model.doGenerateCalls).toHaveLength(1);
  expect(model.doGenerateCalls[0]).toMatchObject({
    responseFormat: {
      type: "json",
      name: "journal_feedback",
      schema: {
        required: ["corrected_text", "corrections"],
        additionalProperties: false,
        properties: { corrections: { maxItems: 3 } },
      },
    },
    providerOptions: { openai: { store: false, strictJsonSchema: true } },
    prompt: [
      { role: "system", content: expect.stringContaining("locale en") },
      {
        role: "user",
        content: [{ type: "text", text: expect.stringContaining('"entry":"Hello"') }],
      },
    ],
  });
});

test.each([undefined, 429, 500, 503])(
  "SDK retries transient %s once and meters both attempts",
  async (status) => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw failure(status, true);
      },
    });
    const db = store();
    await runFeedback(job, db, createFeedbackProvider(model));
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(db.reserve).toHaveBeenCalledExactlyOnceWith(job, "retry");
    expect(db.claim.mock.calls).toEqual([["initial"], ["retry"]]);
    expect(db.log.mock.calls.map(([id]) => id)).toEqual(["initial", "retry"]);
    expect(db.failed).toHaveBeenCalledWith(job.id, "provider_error");
  },
);

test.each([400, 401])("SDK does not retry HTTP %s", async (status) => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      throw failure(status);
    },
  });
  const db = store();
  await runFeedback(job, db, createFeedbackProvider(model));
  expect(model.doGenerateCalls).toHaveLength(1);
  expect(db.reserve).not.toHaveBeenCalled();
  expect(db.failed).toHaveBeenCalledWith(job.id, "provider_error");
});

test("daily cap blocks an SDK retry before a second model call", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      throw failure(503);
    },
  });
  const db = store();
  db.reserve.mockResolvedValue(null);
  await runFeedback(job, db, createFeedbackProvider(model));
  expect(model.doGenerateCalls).toHaveLength(1);
  expect(db.log).toHaveBeenCalledOnce();
  expect(db.failed).toHaveBeenCalledWith(job.id, "daily_cap_reached");
});

test("failed retry claim blocks the model after deletion", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      throw failure(503);
    },
  });
  const db = store();
  db.claim.mockResolvedValueOnce(true).mockResolvedValue(false);
  await runFeedback(job, db, createFeedbackProvider(model));
  expect(model.doGenerateCalls).toHaveLength(1);
  expect(db.failed).toHaveBeenCalledWith(job.id, "provider_error");
});

test.each(["{}", "{", JSON.stringify({ ...good, corrected_text: "a".repeat(2001) })])(
  "SDK validation passes its error into exactly one repair: %s",
  async (invalid) => {
    const model = new MockLanguageModelV4({ doGenerate: [response(invalid), response()] });
    const db = store();
    await runFeedback(job, db, createFeedbackProvider(model));
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(db.reserve).toHaveBeenCalledExactlyOnceWith(job, "repair");
    const prompt = model.doGenerateCalls[1].prompt.find((p) => p.role === "user");
    expect(JSON.stringify(prompt)).toContain("repair");
    expect(JSON.stringify(prompt)).toContain("Error");
    expect(db.ready).toHaveBeenCalledWith(job, good);
    expect(db.log).toHaveBeenCalledWith(
      "initial",
      expect.objectContaining({ inputTokens: 7, outputTokens: 8 }),
    );
  },
);

test("repeated invalid SDK output fails after one repair", async () => {
  const model = new MockLanguageModelV4({ doGenerate: response("{}") });
  const db = store();
  await runFeedback(job, db, createFeedbackProvider(model));
  expect(model.doGenerateCalls).toHaveLength(2);
  expect(db.failed).toHaveBeenCalledWith(job.id, "invalid_output");
});

test("SDK-valid output still enters repair when an original span is absent", async () => {
  const invalid = {
    ...good,
    corrections: [
      {
        original: "Missing",
        fix: "Hello",
        category: "grammar",
        explanation: "Use the correct form when describing a completed action.",
      },
    ],
  };
  const model = new MockLanguageModelV4({
    doGenerate: [response(JSON.stringify(invalid)), response()],
  });
  const db = store();
  await runFeedback(job, db, createFeedbackProvider(model));
  expect(model.doGenerateCalls).toHaveLength(2);
  expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain("invalid_span");
  expect(db.ready).toHaveBeenCalledWith(job, good);
});

test("refusal retains usage and enters the single repair path", async () => {
  const model = new MockLanguageModelV4({ doGenerate: [response(""), response()] });
  const db = store();
  await runFeedback(job, db, createFeedbackProvider(model));
  expect(model.doGenerateCalls).toHaveLength(2);
  expect(db.reserve).toHaveBeenCalledExactlyOnceWith(job, "repair");
  expect(db.log).toHaveBeenCalledWith(
    "initial",
    expect.objectContaining({ inputTokens: 7, outputTokens: 8 }),
  );
  expect(db.ready).toHaveBeenCalledWith(job, good);
});

test("incomplete output enters repair even when its JSON is valid", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: [
      { ...response(), finishReason: { unified: "length", raw: undefined } },
      response(),
    ],
  });
  const db = store();
  await runFeedback(job, db, createFeedbackProvider(model));
  expect(model.doGenerateCalls).toHaveLength(2);
  expect(db.reserve).toHaveBeenCalledExactlyOnceWith(job, "repair");
  expect(db.ready).toHaveBeenCalledWith(job, good);
});

test("one retry plus one repair permits at most three metered model calls", async () => {
  let calls = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      calls++;
      if (calls !== 2) throw failure(503);
      return response("{}");
    },
  });
  const db = store();
  await runFeedback(job, db, createFeedbackProvider(model));
  expect(model.doGenerateCalls).toHaveLength(3);
  expect(db.reserve.mock.calls.map(([, kind]) => kind)).toEqual(["retry", "repair"]);
  expect(db.failed).toHaveBeenCalledWith(job.id, "provider_error");
});

test("repair may use the single retry when analysis did not need it", async () => {
  let calls = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      calls++;
      if (calls === 2) throw failure(503);
      return calls === 1 ? response("{}") : response();
    },
  });
  const db = store();
  await runFeedback(job, db, createFeedbackProvider(model));
  expect(model.doGenerateCalls).toHaveLength(3);
  expect(db.reserve.mock.calls.map(([, kind]) => kind)).toEqual(["repair", "retry"]);
  expect(db.ready).toHaveBeenCalledWith(job, good);
});

test("20 second timeout aborts the SDK model without retrying", async () => {
  vi.useFakeTimers();
  const model = new MockLanguageModelV4({
    doGenerate: ({ abortSignal }) =>
      new Promise((_, reject) => {
        abortSignal?.addEventListener("abort", () => reject(abortSignal.reason), { once: true });
      }),
  });
  const db = store();
  const running = runFeedback(job, db, createFeedbackProvider(model));
  await vi.advanceTimersByTimeAsync(20_000);
  await running;
  expect(model.doGenerateCalls).toHaveLength(1);
  expect(model.doGenerateCalls[0].abortSignal?.aborted).toBe(true);
  expect(db.reserve).not.toHaveBeenCalled();
  expect(db.failed).toHaveBeenCalledWith(job.id, "timeout");
});

test("missing server key fails before making a model request", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  await expect(
    openAIProvider.generate(job.input, new AbortController().signal),
  ).rejects.toMatchObject({
    reason: "missing_api_key",
  });
});
