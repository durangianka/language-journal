import { expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { jevClient, jevEndpoint, jevModel } from "../../src/lib/jev/client";
import { feedbackJevQuestions } from "../../src/lib/jev/contract";

test("the gate preserves Jev HTTP shape and sends target-language choice criteria", async () => {
  vi.stubEnv("JEV_API_KEY", "fake-test-key");
  const answers = { text_kind: { choice: "informal_language" } };
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ answers }) });
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  const questions = feedbackJevQuestions("it");
  expect(await jevClient.judge("Oggi resto qui xké piove.", signal, questions)).toEqual(answers);
  expect(fetch).toHaveBeenCalledWith(jevEndpoint, {
    method: "POST",
    headers: { Authorization: "Bearer fake-test-key", "Content-Type": "application/json" },
    body: JSON.stringify({ model: jevModel, state: "Oggi resto qui xké piove.", questions }),
    signal,
    cache: "no-store",
  });
  vi.unstubAllEnvs();
});
