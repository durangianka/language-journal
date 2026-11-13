import { writeFile } from "node:fs/promises";
import { afterAll, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
vi.mock("server-only", () => ({}));
import { client, db } from "../../src/db/client";
import { jevCalls, modelCalls } from "../../src/db/schema";
import { jevClient } from "../../src/lib/jev/client";
import { jevStore } from "../../src/lib/jev/repository";
import { checkEntryLanguage } from "../../src/lib/jev/service";

afterAll(async () => {
  await client.end();
});

test.skipIf(process.env.RUN_JEV_GATE_LIVE !== "1")(
  "six Jev language gate checks, no model calls",
  async () => {
    if (new URL(process.env.DATABASE_URL!).pathname !== "/journal_test")
      throw new Error("journal_test required");
    const before = await db.select({ id: modelCalls.id }).from(modelCalls);
    const lines = [
      "# Jev language gate live results",
      "",
      `Run: ${new Date().toISOString()}. Database: journal_test only. Target language per input.`,
      "Credentials loaded by dotenv without inspecting or printing .env contents.",
      "Six calls through the existing Jev client, timeout, reservation and call log. No feedback model imported or invoked.",
      "Request shape unchanged: POST /v1/systemone with { model, state, questions }; choice criteria is an object.",
      "Shorthand examples use only verified items from docs/research/shorthand-reference.md. Register by level is app policy inferred from the research, not a CEFR rule.",
      "",
    ];
    let correct = 0;
    try {
      for (const [language, text, expected, shouldAllow] of [
        [
          "es",
          "Ayer fui al mercado y compré fruta fresca para preparar la cena.",
          "standard_language",
          true,
        ],
        ["it", "Oggi resto a casa xké sono stanco e voglio riposare.", "informal_language", true],
        [
          "en",
          "tbh I really enjoyed the lesson today and want to learn more.",
          "informal_language",
          true,
        ],
        ["en", "Today I studied that A equals 2 plus B equals 75.", "mixed", true],
        ["es", "0x4F 0x2A 0xFF", "encoded", false],
        ["es", "asdf qwer zxcv", "random", false],
      ] as const) {
        let callId: string | null = null;
        const allowed = await checkEntryLanguage(text, language, null, jevClient, {
          async reserve(entryId, questions) {
            callId = await jevStore.reserve(entryId, questions);
            return callId;
          },
          finish: jevStore.finish,
        });
        const [call] = callId
          ? await db.select().from(jevCalls).where(eq(jevCalls.id, callId))
          : [];
        const answers = call?.answers as {
          text_kind?: { choice: string; confidence: number };
        } | null;
        lines.push(
          `Input (${language}): ${text}`,
          `Expected: ${expected}. Allowed: ${allowed}.`,
          `Answer: ${JSON.stringify(call?.answers ?? null)}`,
          `Duration: ${call?.durationMs ?? "unavailable"} ms.`,
          "",
        );
        if (answers?.text_kind?.choice === expected && allowed === shouldAllow) correct++;
      }
      const after = await db.select({ id: modelCalls.id }).from(modelCalls);
      lines.push(
        `Matching classifications and gate outcomes: ${correct}/6. Model call rows before: ${before.length}; after: ${after.length}.`,
        "",
      );
      expect(after).toEqual(before);
    } finally {
      await writeFile("docs/jev-gate-live-results.md", lines.join("\n"), "utf8");
    }
    expect(correct).toBe(6);
  },
  60_000,
);
