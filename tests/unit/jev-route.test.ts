import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("../../src/lib/journal", () => ({ getJournal: vi.fn(), getEntry: vi.fn() }));
vi.mock("../../src/lib/jev/service", () => ({ judgeEntry: vi.fn() }));
vi.mock("../../src/lib/jev/client", () => ({ jevClient: {} }));
vi.mock("../../src/lib/jev/repository", () => ({ jevStore: {} }));
vi.mock("../../src/lib/jev/test-client", () => ({ testJevClient: {} }));

import { POST } from "../../src/app/api/jev/route";
import { getJournal } from "../../src/lib/journal";
import { judgeEntry } from "../../src/lib/jev/service";

function request(
  body = JSON.stringify({ journalId: "a1aab8c4-c90b-419a-9110-8266da54bf96", text: "Hola amgo" }),
) {
  return new Request("http://localhost:3000/api/jev", {
    method: "POST",
    headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    body,
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
  const sentinel = "PRIVATE_JOURNAL_SENTINEL";
  const input = request(`{"text": ${sentinel}}`);
  const response = await POST(input);
  expect(response.status).toBe(200);
  expect(await response.json()).toBeNull();
  expect(console.error).toHaveBeenCalledWith("jev_route_failed", { status: 200 });
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(sentinel);
  expect(judgeEntry).not.toHaveBeenCalled();
});

test.each(["lookup", "judge"])(
  "%s errors are logged and return a fail-open response",
  async (stage) => {
    const error = new Error("PRIVATE_PROVIDER_SENTINEL");
    if (stage === "lookup") vi.mocked(getJournal).mockRejectedValue(error);
    else vi.mocked(judgeEntry).mockRejectedValue(error);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
    expect(console.error).toHaveBeenCalledWith("jev_route_failed", { status: 200 });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(error.message);
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
  expect(console.error).toHaveBeenCalledWith("jev_route_failed", { status: 200 });
});

test.each([true, false])(
  "oversized body with content-length %s returns 413 before parsing",
  async (withLength) => {
    const body = JSON.stringify({
      journalId: "a1aab8c4-c90b-419a-9110-8266da54bf96",
      text: "Hola amgo",
      padding: "a".repeat(20_000),
    });
    const input = request(body);
    if (withLength)
      input.headers.set("content-length", String(new TextEncoder().encode(body).length));
    expect((await POST(input)).status).toBe(413);
    expect(getJournal).not.toHaveBeenCalled();
    expect(judgeEntry).not.toHaveBeenCalled();
  },
);

test("streamed UTF-8 bytes are bounded and the remaining stream is cancelled", async () => {
  const cancel = vi.fn();
  const chunks = [
    new TextEncoder().encode('{"padding":"'),
    new TextEncoder().encode("😀".repeat(5_000)),
    new TextEncoder().encode('"}'),
  ];
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (chunks.length) controller.enqueue(chunks.shift()!);
      else controller.close();
    },
    cancel,
  });
  const input = new Request("http://localhost:3000/api/jev", {
    method: "POST",
    headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    body: stream,
    duplex: "half",
  } as RequestInit);
  expect((await POST(input)).status).toBe(413);
  expect(cancel).toHaveBeenCalledOnce();
  expect(getJournal).not.toHaveBeenCalled();
});

test("an exact 20000-byte JSON body remains valid", async () => {
  const base = JSON.stringify({
    journalId: "a1aab8c4-c90b-419a-9110-8266da54bf96",
    text: "Hola amgo",
    padding: "",
  });
  const body = base.replace('"padding":""', `"padding":"${"a".repeat(20_000 - base.length)}"`);
  vi.mocked(judgeEntry).mockResolvedValue(null);
  expect((await POST(request(body))).status).toBe(200);
  expect(judgeEntry).toHaveBeenCalledOnce();
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
