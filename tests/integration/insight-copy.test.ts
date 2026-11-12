import { afterAll, afterEach, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";

vi.mock("server-only", () => ({}));
vi.mock("../../src/components/journal-summary", () => ({ JournalSummary: () => null }));

import { client, db } from "../../src/db/client";
import { journals } from "../../src/db/schema";
import { JournalInsight } from "../../src/components/journal-insight";
import { dictionaries } from "../../src/i18n/dictionaries";
import { locales } from "../../src/config/locales";
import { createEntry, createJournal, deleteEntry } from "../../src/lib/journal";
import { beginFeedback, feedbackStore } from "../../src/lib/ai/repository";
import { runFeedback } from "../../src/lib/ai/service";

const ids: string[] = [];
afterEach(async () => {
  for (const id of ids.splice(0)) await db.delete(journals).where(eq(journals.id, id));
});
afterAll(async () => {
  await client.end();
});

test.each(locales)(
  "%s insight waits at 2 corrections and appears at 5, excluding deleted entries",
  async (locale) => {
    const journal = await createJournal({ language: "en", level: "basic", focus: [] });
    ids.push(journal.id);
    const t = dictionaries[locale];
    const render = async () =>
      renderToStaticMarkup(
        await JournalInsight({
          params: Promise.resolve({ id: journal.id }),
          locale,
          t,
        }),
      );
    async function addCorrections(categories: ("grammar" | "spelling" | "style")[]) {
      const entry = await createEntry({ journalId: journal.id, body: "I goes to the market." });
      const job = await beginFeedback(entry.id, "en");
      await runFeedback(job, feedbackStore, {
        generate: async () => ({
          text: JSON.stringify({
            corrected_text: "I go to the market.",
            corrections: categories.map((category) => ({
              original: "goes",
              fix: "go",
              category,
              explanation: "Use the base verb with I.",
            })),
          }),
          inputTokens: 10,
          outputTokens: 10,
        }),
      });
      return entry;
    }

    expect(await render()).toContain(t.insightNoMistakes.replace("{count}", "0"));
    await addCorrections(["grammar", "spelling"]);
    const waiting = await render();
    expect(waiting).toContain(t.insightCountsHeading);
    expect(waiting).toContain(t.insightCountsScope);
    expect(waiting).toContain(`${t.grammar}: ${t.insightCorrection.replace("{count}", "1")}`);
    expect(waiting).toContain(t.insightNoMistakes.replace("{count}", "2"));
    expect(waiting).not.toContain(t.insightTopCategory.replace("{category}", t.grammar));

    const extra = await addCorrections(["grammar", "grammar", "style"]);
    const ready = await render();
    expect(ready).toContain(`${t.grammar}: ${t.insightCorrections.replace("{count}", "3")}`);
    expect(ready).toContain(t.insightTopCategory.replace("{category}", t.grammar));
    expect(ready).not.toContain(t.insightNoMistakes.replace("{count}", "5"));

    await deleteEntry(extra.id, "soft");
    const afterDeletion = await render();
    expect(afterDeletion).toContain(t.insightNoMistakes.replace("{count}", "2"));
    expect(afterDeletion).not.toContain(t.insightTopCategory.replace("{category}", t.grammar));
  },
);
