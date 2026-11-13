import { writeFile } from "node:fs/promises";
import { afterAll, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
vi.mock("server-only", () => ({}));
import { db, client } from "../../src/db/client";
import { jevCalls, journals, modelCalls } from "../../src/db/schema";
import { jevClient, jevEndpoint, jevModel } from "../../src/lib/jev/client";
import { jevStore } from "../../src/lib/jev/repository";
import { judgeEntry } from "../../src/lib/jev/service";
import { createEntry, createJournal, deleteEntry } from "../../src/lib/journal";
import { summariseJournal } from "../../src/lib/insight/repository";
import { summaryProvider } from "../../src/lib/insight/provider";
import { locales } from "../../src/config/locales";

afterAll(async () => {
  await client.end();
});

test.skipIf(process.env.RUN_STAGE2_LIVE !== "1")(
  "six real Jev decisions and three real journal summaries",
  async () => {
    if (new URL(process.env.DATABASE_URL!).pathname !== "/journal_test")
      throw new Error("journal_test required");
    const lines = [
      "# Stage 2 live results",
      "",
      `Run: ${new Date().toISOString()}. Database: journal_test only.`,
      "Credentials were loaded by dotenv without printing or inspecting .env contents.",
      "",
      `Jev: POST ${jevEndpoint}, Bearer authentication, model ${jevModel}.`,
      "Request: { model, state, questions }; choice criteria is an object; score criteria is an array.",
      "Docs checked: https://jev-ai.org/docs/ and https://api.typesafe.ai/redoc (OpenAPI schema and authenticated GET /v1/models).",
      "The docs demonstrate support routing, not a journal example. Instructions follow the example question wording, adapted to language issues.",
      "",
      "## Jev",
      "",
    ];
    let decisions = 0;
    let summaries = 0;
    try {
      for (const [language, text] of [
        ["en", "Yesterday I went to the market and bought fresh fruit for dinner."],
        ["en", "Yesterday I goed to the market and buyed fresh fruit for dinner."],
        ["es", "Ayer fui al mercado y compré fruta fresca para preparar la cena."],
        ["es", "Ayer yo ir al mercado y comprar frutas para mi familia."],
        ["it", "Ieri sono andato al mercato e ho comprato della frutta fresca."],
        ["it", "Ieri io andare al mercato e comprare della frutta fresca."],
      ]) {
        let callId: string | null = null;
        const note = await judgeEntry(text, null, jevClient, {
          async reserve(entryId) {
            callId = await jevStore.reserve(entryId);
            return callId;
          },
          finish: jevStore.finish,
        }, "es");
        const [call] = callId
          ? await db.select().from(jevCalls).where(eq(jevCalls.id, callId))
          : [];
        lines.push(
          `Entry (${language}): ${text}`,
          `Answer: ${JSON.stringify(call?.answers ?? null)}`,
          `Confidence: ${call?.confidence ?? "unavailable"}. Duration: ${call?.durationMs ?? "unavailable"} ms. UI note: ${JSON.stringify(note)}.`,
          "",
        );
        if (call?.answers) decisions++;
      }
      lines.push(
        "## LLM journal summaries",
        "",
        "Model: gpt-6-luna. One call per test journal; three separate journals respect the daily per-journal limit.",
        "",
      );
      for (const locale of locales) {
        const journal = await createJournal({ language: "en", level: "basic", focus: ["grammar"] });
        try {
          const texts = [
            "Yesterday I goed to the shop.",
            "Today I read a book and learned five new words.",
            "I wants to practise writing every day.",
          ];
          for (const body of texts) await createEntry({ journalId: journal.id, body });
          const removed = await createEntry({ journalId: journal.id, body: "DELETED_SENTINEL" });
          await deleteEntry(removed.id, "soft");
          let input: string[] = [];
          const result = await summariseJournal(journal.id, locale, async (value) => {
            input = value.entries;
            return summaryProvider(value);
          });
          const calls = await db
            .select()
            .from(modelCalls)
            .where(eq(modelCalls.journalId, journal.id));
          lines.push(
            `Locale: ${locale}. Entries: ${JSON.stringify(input)}`,
            `Output: ${result.summary ?? "unavailable"}`,
            `Model calls: ${calls.length}. Outcome: ${calls[0]?.outcome}. Input tokens: ${calls[0]?.inputTokens}. Output tokens: ${calls[0]?.outputTokens}.`,
            "",
          );
          expect(input).not.toContain("DELETED_SENTINEL");
          expect(calls).toHaveLength(1);
          if (result.summary && calls[0].outcome === "ready") summaries++;
        } finally {
          await db.delete(journals).where(eq(journals.id, journal.id));
        }
      }
    } finally {
      lines.push(
        `Observed successful Jev decisions: ${decisions}/6. Observed successful LLM summaries: ${summaries}/3.`,
        "",
      );
      await writeFile("docs/stage2-live-results.md", lines.join("\n"), "utf8");
    }
    expect(decisions).toBe(6);
    expect(summaries).toBe(3);
  },
  150_000,
);
