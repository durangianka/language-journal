import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/journal", () => ({ getJournal: vi.fn(), getEntry: vi.fn() }));
vi.mock("../../src/lib/jev/repository", () => ({
  jevStore: { reserve: vi.fn(), finish: vi.fn() },
}));

import { POST } from "../../src/app/api/jev/route";
import { getJournal } from "../../src/lib/journal";
import { jevStore } from "../../src/lib/jev/repository";
import { jevEndpoint } from "../../src/lib/jev/client";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("JEV_TEST_MODE", "0");
  vi.stubEnv("JEV_API_KEY", "fake-test-key");
  vi.mocked(getJournal).mockResolvedValue({ id: "journal" } as Awaited<
    ReturnType<typeof getJournal>
  >);
  vi.mocked(jevStore.reserve).mockResolvedValue("call");
  vi.mocked(jevStore.finish).mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.unstubAllEnvs());

test.each([
  ["provider HTTP failure", () => new Response("unavailable", { status: 503 }), "Error"],
  ["malformed provider JSON", () => new Response("{"), "SyntaxError"],
  ["null provider JSON", () => Response.json(null), "TypeError"],
  ["missing answers", () => Response.json({}), "ZodError"],
  ["invalid answers", () => Response.json({ answers: { main_issue: "spelling" } }), "ZodError"],
] as const)(
  "%s returns HTTP 200 with no note and logs a stack",
  async (_name, reply, errorName) => {
    const fetch = vi.fn().mockResolvedValue(reply());
    vi.stubGlobal("fetch", fetch);
    const response = await POST(
      new Request("http://localhost:3000/api/jev", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
        body: JSON.stringify({
          journalId: "a1aab8c4-c90b-419a-9110-8266da54bf96",
          text: "Hola amgo",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
    expect(fetch).toHaveBeenCalledWith(jevEndpoint, expect.objectContaining({ method: "POST" }));
    expect(jevStore.finish).toHaveBeenCalledWith("call", null, expect.any(Number));
    expect(console.error).toHaveBeenCalledWith("Jev check failed", {
      error: expect.objectContaining({ name: errorName }),
      stack: expect.stringContaining(errorName),
    });
    if (_name === "provider HTTP failure") {
      expect(console.error).toHaveBeenCalledWith("Jev check failed", {
        error: expect.objectContaining({ message: "Jev request failed (503)" }),
        stack: expect.stringContaining("Jev request failed (503)"),
      });
    }
  },
);
