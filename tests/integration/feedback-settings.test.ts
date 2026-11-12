import { afterAll, afterEach, expect, test, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
vi.mock("server-only", () => ({}));
import { db, client } from "../../src/db/client";
import { feedbackSettings, journals, modelCalls } from "../../src/db/schema";
import { getFeedbackSettings, saveFeedbackSettings } from "../../src/lib/settings/repository";
import { defaultFeedbackSettings } from "../../src/lib/settings/schema";
import { createEntry, createJournal } from "../../src/lib/journal";
import { beginFeedback, feedbackStore } from "../../src/lib/ai/repository";
import { runFeedback } from "../../src/lib/ai/service";
import { feedbackPrompt } from "../../src/lib/ai/prompt";

const journalIds: string[] = [];
afterEach(async () => {
  await db.delete(feedbackSettings);
  for (const id of journalIds.splice(0)) await db.delete(journals).where(eq(journals.id, id));
  await db.delete(modelCalls);
});
afterAll(async () => {
  await client.end();
});

test("missing row uses defaults and saves upsert one learner's settings", async () => {
  await db.delete(feedbackSettings);
  expect(await getFeedbackSettings()).toEqual(defaultFeedbackSettings);
  await saveFeedbackSettings({ tone: "slang", address: "bro", learnerGender: "male" });
  expect(await getFeedbackSettings()).toEqual({
    tone: "slang",
    address: "bro",
    learnerGender: "male",
  });
  await saveFeedbackSettings({ tone: "friendly", address: "sis", learnerGender: "female" });
  expect(await getFeedbackSettings()).toEqual({
    tone: "friendly",
    address: "sis",
    learnerGender: "female",
  });
  expect(await db.select().from(feedbackSettings)).toHaveLength(1);
});

test("saved settings travel through feedback input and provider as a snapshot", async () => {
  const settings = { tone: "friendly", address: "sis", learnerGender: "female" } as const;
  await saveFeedbackSettings(settings);
  const journal = await createJournal({ language: "it", level: "advanced", focus: [] });
  journalIds.push(journal.id);
  const entry = await createEntry({ journalId: journal.id, body: "Oggi scrivo nel diario." });
  const job = await beginFeedback(entry.id, "en");
  expect(job.input.settings).toEqual(await getFeedbackSettings());
  expect(JSON.parse(feedbackPrompt(job.input).input).settings).toEqual(settings);
  await saveFeedbackSettings(defaultFeedbackSettings);
  const generate = vi
    .fn()
    .mockResolvedValue({
      text: JSON.stringify({ corrected_text: entry.body, corrections: [] }),
      inputTokens: 1,
      outputTokens: 1,
    });
  await runFeedback(job, feedbackStore, { generate });
  expect(generate).toHaveBeenCalledOnce();
  expect(generate.mock.calls[0][0].settings).toEqual(settings);
});

test("database defaults and CHECK constraints reject invalid values and a second learner", async () => {
  await db.delete(feedbackSettings);
  await db.insert(feedbackSettings).values({});
  expect(await getFeedbackSettings()).toEqual(defaultFeedbackSettings);
  for (const query of [
    sql`update feedback_settings set tone = 'rude'`,
    sql`update feedback_settings set address = 'other'`,
    sql`update feedback_settings set learner_gender = 'other'`,
    sql`insert into feedback_settings (id) values (2)`,
    sql`insert into feedback_settings (id) values (1)`,
    sql`update feedback_settings set tone = null`,
  ])
    await expect(db.execute(query)).rejects.toThrow();
  expect(await getFeedbackSettings()).toEqual(defaultFeedbackSettings);
  expect(await db.select().from(feedbackSettings)).toHaveLength(1);
});
