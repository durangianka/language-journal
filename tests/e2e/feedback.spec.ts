import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test, type Page } from "@playwright/test";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_REASONS,
  type EntryDto,
  type FeedbackDto,
  type Locale,
} from "../../src/lib/feedback-contract";
import { STUB_STORAGE_KEY } from "../../src/lib/feedback-client";
import { dictionaries } from "../../src/i18n/dictionaries";
import { testDatabaseUrl } from "../support/test-database-url";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
let journalId = "";
let entries: EntryDto[] = [];
test.beforeEach(async () => {
  journalId = randomUUID();
  entries = [];
  const sql = postgres(testDatabaseUrl());
  try {
    await sql`insert into journals (id, language, level) values (${journalId}, 'en', 'basic')`;
    for (let index = 0; index < 10; index++) {
      const id = randomUUID();
      const body = index === 0 ? "I goes to school." : `Entry ${index + 1}: Today I read a story.`;
      await sql`insert into entries (id, journal_id, body, entry_date) values (${id}, ${journalId}, ${body}, ${`2026-11-${String(index + 1).padStart(2, "0")}`})`;
      entries.push({
        id,
        journalId,
        body,
        entryDate: `2026-11-${String(index + 1).padStart(2, "0")}`,
        createdAt: "2026-11-10T12:00:00.000Z",
        updatedAt: "2026-11-10T12:00:00.000Z",
        latestFeedback: null,
      });
    }
  } finally {
    await sql.end();
  }
});
test.afterEach(async () => {
  const sql = postgres(testDatabaseUrl());
  try {
    await sql`delete from journals where id = ${journalId}`;
  } finally {
    await sql.end();
  }
});

function detail(index = 0) {
  return `/journals/${journalId}/entries/${entries[index].id}`;
}
function feedback(status: FeedbackDto["status"] = "ready"): FeedbackDto {
  return {
    id: randomUUID(),
    entryId: entries[0].id,
    status,
    reason: null,
    locale: "en",
    correctedText: "I go to school.",
    corrections: [],
    createdAt: "2026-11-10T12:00:00.000Z",
  };
}
async function store(page: Page, values: FeedbackDto[]) {
  await page.evaluate(
    ({ key, values }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          feedback: Object.fromEntries(values.map((value) => [value.entryId, value])),
          deletedEntries: {},
          deletedJournals: {},
        }),
      );
      window.dispatchEvent(new Event("storage"));
    },
    { key: STUB_STORAGE_KEY, values },
  );
}
async function mobileChecks(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const target of await page.locator("a[href]:visible, button:visible").all()) {
    // Dialog scale animations briefly change the measured bounds before settling.
    await expect
      .poll(async () => (await target.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(44);
    await expect
      .poll(async () => (await target.boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(44);
  }
  expect(await page.locator("body").innerText()).not.toContain("\u2014");
}

test("old entry opens, requests sample feedback, announces pending and retains latest feedback after reload", async ({
  page,
}) => {
  await page.goto(detail());
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackNoFeedback);
  await page.getByRole("button", { name: "Get feedback", exact: true }).tap();
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackPending);
  await expect(
    page.getByRole("button", { name: dictionaries.en.feedbackPending, exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackReady);
  await expect(page.getByText("I go to school.", { exact: true })).toBeVisible();
  await expect(page.locator("mark")).toHaveText("I goes");
  await expect(page.getByText("I goes to school.", { exact: true })).toBeVisible();
  await mobileChecks(page);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackReady);
  await expect(page.locator("time").last()).toHaveAttribute("datetime", /T/);
  await page.getByRole("link", { name: "Back to journal", exact: true }).tap();
  await expect(page.locator(`a[href="${detail()}"]`)).toContainText("Feedback ready");
  await page.goto("/journals");
  await expect(page.locator(`a[href="${detail()}"]`)).toContainText("Feedback ready");
});

test("review rows show every status and ready feedback displays no more than three labelled correction cards", async ({
  page,
}) => {
  await page.goto(detail());
  const ready = feedback();
  ready.corrections = FEEDBACK_CATEGORIES.map((category) => ({
    original: "I goes",
    fix: "I go",
    category,
    explanation: "Use the subject's verb form.",
  }));
  await store(page, [
    ready,
    { ...feedback("pending"), entryId: entries[1].id },
    { ...feedback("failed"), entryId: entries[2].id, reason: "timeout" },
  ]);
  await expect(page.locator("mark")).toHaveCount(3);
  for (const category of FEEDBACK_CATEGORIES.slice(0, 3))
    await expect(page.getByText(dictionaries.en[category], { exact: true })).toBeVisible();
  await mobileChecks(page);
  ready.corrections = [ready.corrections[3]];
  await store(page, [ready]);
  await expect(page.getByText("Style", { exact: true })).toBeVisible();
  await page.goto(`/journals/${journalId}`);
  await store(page, [
    ready,
    { ...feedback("pending"), entryId: entries[1].id },
    { ...feedback("failed"), entryId: entries[2].id, reason: "timeout" },
  ]);
  for (const [index, status] of [
    "Feedback ready",
    "Feedback pending",
    "Feedback failed",
    "No feedback",
  ].entries())
    await expect(page.locator(`a[href="${detail(index)}"]`)).toContainText(status);
  await page.goto(detail(1));
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackPending);
  await expect(
    page.getByRole("button", { name: dictionaries.en.feedbackPending, exact: true }),
  ).toBeDisabled();
});

for (const locale of ["en", "es", "it"]) {
  test(`${locale} failures show every learner-safe reason and retry sample feedback`, async ({
    page,
    context,
  }) => {
    if (locale !== "en" && locale !== "es" && locale !== "it")
      throw new Error("Invalid test locale");
    const language: Locale = locale;
    const t = dictionaries[language];
    await context.addCookies([{ name: "locale", value: locale, url: "http://127.0.0.1:3100" }]);
    await page.goto(detail());
    for (const reason of FEEDBACK_REASONS) {
      await store(page, [{ ...feedback("failed"), reason, locale: language }]);
      await expect(page.getByRole("status")).toContainText(t[reason]);
      await expect(page.getByRole("button", { name: t.retryFeedback, exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: t.retryFeedback, exact: true }).tap();
    await expect(page.getByRole("status")).toHaveText(t.feedbackReady);
    await expect(page.getByText(t.grammar, { exact: true })).toBeVisible();
    await expect(page.locator("dd").last()).toHaveAttribute("lang", locale);
    await mobileChecks(page);
    await page.getByRole("button", { name: t.deletePermanently, exact: true }).tap();
    await expect(page.getByRole("alertdialog")).toContainText(t.deletePermanentlyTitle);
    await mobileChecks(page);
    await page.getByRole("button", { name: t.cancel, exact: true }).tap();
    await expect(
      page.getByRole("button", { name: t.deletePermanently, exact: true }),
    ).toBeFocused();
  });
}

test("ten active entries block both creation links and direct creation routes; moving to trash restores capacity", async ({
  page,
}) => {
  await page.goto(`/journals/${journalId}`);
  await expect(page.getByText(dictionaries.en.journalEntryLimitReached)).toBeVisible();
  await expect(page.locator("main li")).toHaveCount(10);
  await expect(page.getByRole("link", { name: "New entry", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "New journal", exact: true })).toHaveAttribute(
    "href",
    "/journals/new",
  );
  await page.goto(`/journals/${journalId}/entries/new`);
  await expect(page.getByText(dictionaries.en.journalEntryLimitReached)).toBeVisible();
  await expect(page.locator("textarea")).toHaveCount(0);
  await page.goto(detail());
  await page.getByRole("button", { name: "Move to trash", exact: true }).tap();
  await expect(page).toHaveURL(new RegExp(`/journals/${journalId}\\?deleted=entry-soft$`));
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.entryMovedToTrash);
  await expect(page.locator("main li")).toHaveCount(9);
  await expect(page.getByRole("link", { name: "New entry", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("main li")).toHaveCount(9);
  await page.goto(detail());
  await expect(page.getByText(dictionaries.en.entryUnavailable, { exact: true })).toBeVisible();
});

test("permanent entry deletion warns with its date, traps focus, cancels and then removes the entry", async ({
  page,
}) => {
  await page.goto(detail());
  const trigger = page.getByRole("button", { name: "Delete permanently", exact: true });
  await trigger.tap();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("November 1, 2026");
  await expect(dialog).toContainText("cannot be restored");
  await mobileChecks(page);
  await page.getByRole("button", { name: "Cancel", exact: true }).tap();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.tap();
  for (let index = 0; index < 4; index++) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
  }
  await page
    .getByRole("button", { name: dictionaries.en.confirmDeletePermanently, exact: true })
    .tap();
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.entryDeletedPermanently);
  await expect(page.locator("main li")).toHaveCount(9);
  await page.goto(detail());
  await expect(page.getByText(dictionaries.en.entryUnavailable, { exact: true })).toBeVisible();
});

for (const mode of ["soft", "hard"]) {
  test(`${mode} journal deletion removes the journal and prevents opening its entries`, async ({
    page,
  }) => {
    await page.goto(`/journals/${journalId}`);
    if (mode === "soft")
      await page.getByRole("button", { name: "Move to trash", exact: true }).tap();
    else {
      await page.getByRole("button", { name: "Delete permanently", exact: true }).tap();
      await expect(page.getByRole("alertdialog")).toContainText(
        dictionaries.en.deleteJournalWarning,
      );
      await page
        .getByRole("button", { name: dictionaries.en.confirmDeletePermanently, exact: true })
        .tap();
    }
    await expect(page).toHaveURL(new RegExp(`/journals\\?deleted=journal-${mode}$`));
    await expect(page.locator(`a[href="/journals/${journalId}"]`)).toHaveCount(0);
    await page.goto(detail());
    await expect(page.getByText(dictionaries.en.entryUnavailable, { exact: true })).toBeVisible();
  });
}

test("an entry from another journal cannot be opened through a mismatched journal route", async ({
  page,
}) => {
  await page.goto(`/journals/${randomUUID()}/entries/${entries[0].id}`);
  await expect(
    page.getByRole("heading", { name: dictionaries.en.journalNotFound, exact: true }),
  ).toBeVisible();
});
