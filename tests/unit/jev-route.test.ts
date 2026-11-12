import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("../../src/lib/journal", () => ({ getJournal: vi.fn(), getEntry: vi.fn() }));
vi.mock("../../src/lib/jev/service", () => ({ judgeEntry: vi.fn() }));
vi.mock("../../src/lib/jev/client", () => ({ jevClient: {} }));
vi.mock("../../src/lib/jev/repository", () => ({ jevStore: {} }));
vi.mock("../../src/lib/jev/test-client", () => ({ testJevClient: {} }));

import { POST } from "../../src/app/api/jev/route";
import { getJournal } from "../../src/lib/journal";
import { judgeEntry } from "../../src/lib/jev/service";

function request() {
  return new Request("http://localhost:3000/api/jev", {
    method: "POST",
    headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    body: JSON.stringify({ journalId: "a1aab8c4-c90b-419a-9110-8266da54bf96", text: "Hola amgo" }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("JEV_TEST_MODE", "1");
  vi.mocked(getJournal).mockResolvedValue({ id: "journal" } as Awaited<
    ReturnType<typeof getJournal>
  >);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.unstubAllEnvs());

test("malformed JSON is logged and returns no note", async () => {
  const input = request();
  vi.spyOn(input, "json").mockRejectedValue(new SyntaxError("Unexpected end of JSON input"));
  const response = await POST(input);
  expect(response.status).toBe(200);
  expect(await response.json()).toBeNull();
  expect(console.error).toHaveBeenCalledWith("Jev route failed", {
    error: expect.any(SyntaxError),
    stack: expect.stringContaining("SyntaxError: Unexpected end of JSON input"),
  });
  expect(judgeEntry).not.toHaveBeenCalled();
});

test.each(["lookup", "judge"])(
  "%s errors are logged and return a fail-open response",
  async (stage) => {
    const error = new Error("dependency unavailable");
    if (stage === "lookup") vi.mocked(getJournal).mockRejectedValue(error);
    else vi.mocked(judgeEntry).mockRejectedValue(error);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
    expect(console.error).toHaveBeenCalledWith("Jev route failed", { error, stack: error.stack });
  },
);

test("origin validation errors are inside the fail-open boundary", async () => {
  const input = request();
  const error = new Error("request headers unavailable");
  vi.spyOn(input.headers, "get").mockImplementation(() => {
    throw error;
  });
  const response = await POST(input);
  expect(response.status).toBe(200);
  expect(await response.json()).toBeNull();
  expect(console.error).toHaveBeenCalledWith("Jev route failed", { error, stack: error.stack });
});

test("cross-origin requests are rejected without a Jev call", async () => {
  const input = request();
  input.headers.set("origin", "http://other.example");
  expect((await POST(input)).status).toBe(403);
  expect(judgeEntry).not.toHaveBeenCalled();
});

test("a valid blur returns the category", async () => {
  const note = { issue: "spelling", confidence: 0.5 } as const;
  vi.mocked(judgeEntry).mockResolvedValue(note);
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(note);
  expect(console.error).not.toHaveBeenCalled();
});
