import { z } from "zod";
import { getJournal, getEntry } from "../../../lib/journal";
import { judgeEntry } from "../../../lib/jev/service";
import { jevClient } from "../../../lib/jev/client";
import { jevStore } from "../../../lib/jev/repository";
import { testJevClient } from "../../../lib/jev/test-client";

const inputSchema = z.object({
  journalId: z.uuid(),
  entryId: z.uuid().nullable().optional(),
  text: z.string().refine((s) => Array.from(s).length <= 2000),
});

const maxBodyBytes = 20_000;
class BodyTooLarge extends Error {}

async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBodyBytes) throw new BodyTooLarge();
  if (!request.body) return JSON.parse("");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) {
        await reader.cancel().catch(() => {});
        throw new BodyTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

export async function POST(request: Request) {
  try {
    // Route Handlers do not inherit Server Action origin checks.
    const origin = request.headers.get("origin");
    // Next.js can reconstruct request.url with the internal listening hostname.
    // Compare the browser origin against the incoming Host, as Server Actions do.
    if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get("host"))
      return Response.json(null, { status: 403 });
    const input = inputSchema.parse(await readJson(request));
    if (!(await getJournal(input.journalId))) return Response.json(null);
    if (input.entryId) {
      const entry = await getEntry(input.entryId);
      if (!entry || entry.journalId !== input.journalId) return Response.json(null);
    }
    if (!process.env.JEV_API_KEY && process.env.JEV_TEST_MODE !== "1") return Response.json(null);
    return Response.json(
      await judgeEntry(
        input.text,
        input.entryId ?? null,
        process.env.JEV_TEST_MODE === "1" ? testJevClient : jevClient,
        jevStore,
      ),
    );
  } catch (error) {
    if (error instanceof BodyTooLarge) return Response.json(null, { status: 413 });
    console.error("jev_route_failed", { status: 200 });
    return Response.json(null);
  }
}
