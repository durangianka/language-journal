import { afterEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { openAIProvider } from "../../src/lib/ai/openai";
const input = {
  analysedText: "Hello",
  language: "en",
  level: "basic",
  locale: "en",
  focus: [],
} satisfies Parameters<typeof openAIProvider.generate>[0];
afterEach(() => vi.unstubAllEnvs());

test("uses the Responses strict schema and server key with no implicit retries", async () => {
  vi.stubEnv("OPENAI_API_KEY", "fake-unit-key");
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        status: "completed",
        output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
        usage: { input_tokens: 7, output_tokens: 8 },
      }),
    );
  vi.stubGlobal("fetch", fetch);
  expect(await openAIProvider.generate(input, new AbortController().signal)).toEqual({
    text: "{}",
    inputTokens: 7,
    outputTokens: 8,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe("https://api.openai.com/v1/responses");
  expect(options.headers.Authorization).toBe("Bearer fake-unit-key");
  expect(JSON.parse(options.body)).toMatchObject({
    model: "gpt-6-luna",
    store: false,
    text: { format: { type: "json_schema", strict: true } },
  });
});
test.each([
  [400, false],
  [401, false],
  [429, false],
  [500, true],
  [503, true],
])("classifies HTTP %i retryability", async (status, retryable) => {
  vi.stubEnv("OPENAI_API_KEY", "fake-unit-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
  await expect(openAIProvider.generate(input, new AbortController().signal)).rejects.toMatchObject({
    retryable,
  });
});
test("missing key never makes a network request", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(openAIProvider.generate(input, new AbortController().signal)).rejects.toMatchObject({
    reason: "missing_api_key",
    retryable: false,
  });
  expect(fetch).not.toHaveBeenCalled();
});
test("refusal goes through output validation, and usage remains available", async () => {
  vi.stubEnv("OPENAI_API_KEY", "fake-unit-key");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          status: "completed",
          output: [{ type: "message", content: [{ type: "refusal" }] }],
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      ),
  );
  expect(await openAIProvider.generate(input, new AbortController().signal)).toEqual({
    text: "",
    inputTokens: 1,
    outputTokens: 1,
  });
});
