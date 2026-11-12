import { z } from "zod";
import { getJournal, getEntry } from "@/lib/journal";
import { judgeEntry } from "@/lib/jev/service";
import { jevClient } from "@/lib/jev/client";
import { jevStore } from "@/lib/jev/repository";
import { testJevClient } from "@/lib/jev/test-client";

const inputSchema = z.object({
  journalId: z.uuid(),
  entryId: z.uuid().nullable().optional(),
  text: z.string().refine((s) => Array.from(s).length <= 2000),
});

export async function POST(request: Request) {
  // Route Handlers do not inherit Server Action origin checks.
  const origin = request.headers.get("origin");
  // Next.js can reconstruct request.url with the internal listening hostname.
  // Compare the browser origin against the incoming Host, as Server Actions do.
  if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get("host"))
    return Response.json(null, { status: 403 });
  try {
    if (Number(request.headers.get("content-length")) > 20_000)
      return Response.json(null, { status: 413 });
    const input = inputSchema.parse(await request.json());
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
  } catch {
    return Response.json(null);
  }
}
