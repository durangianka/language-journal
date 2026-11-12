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
import { dictionaries } from "../../src/i18n/dictionaries";
import { testDatabaseUrl } from "../support/test-database-url";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
let journalId = "";
let entries: EntryDto[] = [];
const createdJournals: string[] = [];
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
    for (const id of createdJournals.splice(0)) await sql`delete from journals where id = ${id}`;
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
  const sql = postgres(testDatabaseUrl());
  try {
    for (const value of values) {
      await sql`delete from feedback where entry_id = ${value.entryId}`;
      await sql`insert into feedback (id, entry_id, analysed_text, locale, status, reason_code, corrected_text, corrections, model, prompt_version)
        values (${value.id}, ${value.entryId}, 'I goes to school.', ${value.locale}, ${value.status}, ${value.reason}, ${value.correctedText}, ${sql.json(value.corrections)}, 'fake', 'test')`;
    }
  } finally {
    await sql.end();
  }
  await page.reload();
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

test("old entry opens, requests fake-model feedback, announces pending and retains latest feedback after reload", async ({
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
  await expect(page.locator("[data-slot=accordion-trigger] s")).toHaveText("I goes");
  await page.getByRole("tab", { name: "Original", exact: true }).click();
  await expect(page.getByText("I goes to school.", { exact: true })).toBeVisible();
  await mobileChecks(page);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackReady);
  await expect(page.locator("time").last()).toHaveAttribute("datetime", /T/);
  await page.getByRole("link", { name: "Back to journal", exact: true }).tap();
  await expect(page.locator(`a[href="${detail()}"]`)).toContainText("Feedback ready");
  await page.getByRole("link", { name: "Journals", exact: true }).tap();
  await expect(page.locator(`a[href="${detail()}"]`)).toContainText("Feedback ready");
});

test("creates a journal and entry, persists fake-model feedback, then soft deletes in Postgres", async ({
  page,
}) => {
  await page.goto("/journals/new");
  await page
    .getByRole("group", { name: "Choose a language", exact: true })
    .getByRole("button", { name: "English", exact: true })
    .click();
  await page.getByRole("radio", { name: "Basic · A2", exact: true }).check();
  await page.getByRole("button", { name: "Create journal", exact: true }).tap();
  await expect(page).toHaveURL(/\/journals\/[a-f0-9-]+$/);
  const id = new URL(page.url()).pathname.split("/")[2];
  createdJournals.push(id);
  await page.getByRole("link", { name: "New entry", exact: true }).tap();
  await page.getByLabel("Your entry", { exact: true }).fill("I goes to school.");
  await page.getByRole("button", { name: "Save entry", exact: true }).tap();
  await expect(page).toHaveURL(new RegExp(`/journals/${id}/entries/[a-f0-9-]+$`));
  const href = new URL(page.url()).pathname;
  const entryId = href.split("/").at(-1)!;
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackPending);
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackReady);
  await expect(page.getByText("I go to school.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackReady);
  await page.getByRole("button", { name: dictionaries.en.entryActions, exact: true }).tap();
  await page.getByRole("menuitem", { name: "Move to trash", exact: true }).tap();
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.entryMovedToTrash);
  await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
  const sql = postgres(testDatabaseUrl());
  try {
    const rows = await sql`select body, deleted_at from entries where id = ${entryId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe("I goes to school.");
    expect(rows[0].deleted_at).not.toBeNull();
    const history =
      await sql`select status, corrected_text from feedback where entry_id = ${entryId}`;
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: "ready", corrected_text: "I go to school." });
  } finally {
    await sql.end();
  }
  await page.reload();
  await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
  await page.goto(href);
  await expect(
    page.getByRole("heading", { name: dictionaries.en.journalNotFound, exact: true }),
  ).toBeVisible();
});

test("fourth feedback request displays the server's per-entry limit and creates no extra job", async ({
  page,
}) => {
  await page.goto(detail());
  for (let count = 0; count < 3; count++) {
    await page
      .getByRole("button", { name: count ? "Get feedback again" : "Get feedback", exact: true })
      .tap();
    await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackPending);
    await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackReady);
  }
  await page.getByRole("button", { name: "Get feedback again", exact: true }).tap();
  await expect(page.getByRole("status")).toContainText(dictionaries.en.entry_limit_reached);
  const sql = postgres(testDatabaseUrl());
  try {
    const rows = await sql`select id from feedback where entry_id = ${entries[0].id}`;
    expect(rows).toHaveLength(3);
  } finally {
    await sql.end();
  }
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
  await expect(page.locator("[data-slot=accordion-trigger] s")).toHaveCount(3);
  for (const category of FEEDBACK_CATEGORIES.slice(0, 3))
    await expect(page.getByText(dictionaries.en[category], { exact: true })).toBeVisible();
  const corrections = page.locator("[data-slot=accordion-trigger]");
  await expect(corrections.first()).toHaveAttribute("aria-expanded", "true");
  await expect(corrections.nth(1)).toHaveAttribute("aria-expanded", "false");
  await corrections.nth(1).tap();
  await expect(corrections.first()).toHaveAttribute("aria-expanded", "false");
  await expect(corrections.nth(1)).toHaveAttribute("aria-expanded", "true");
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
  test(`${locale} failures show every learner-safe reason and retry fake-model feedback`, async ({
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
    await page.getByRole("button", { name: t.entryActions, exact: true }).tap();
    await page.getByRole("menuitem", { name: t.deletePermanently, exact: true }).tap();
    await expect(page.getByRole("alertdialog")).toContainText(t.deletePermanentlyTitle);
    await mobileChecks(page);
    await page.getByRole("button", { name: t.cancel, exact: true }).tap();
    await expect(page.getByRole("button", { name: t.entryActions, exact: true })).toBeFocused();
  });
}

test("ten-entry cap blocks creation and the server preserves the cap after soft deletion", async ({
  page,
}) => {
  await page.goto(`/journals/${journalId}`);
  await expect(page.getByText(dictionaries.en.journalEntryLimitReached)).toBeVisible();
  await expect(page.locator("main:visible li")).toHaveCount(10);
  await expect(page.getByRole("link", { name: "New entry", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "New journal", exact: true })).toHaveAttribute(
    "href",
    "/journals/new",
  );
  await page.goto(`/journals/${journalId}/entries/new`);
  await expect(page.getByText(dictionaries.en.journalEntryLimitReached)).toBeVisible();
  await expect(page.locator("textarea")).toHaveCount(0);
  await page.goto(detail());
  await page.getByRole("button", { name: dictionaries.en.entryActions, exact: true }).tap();
  await page.getByRole("menuitem", { name: "Move to trash", exact: true }).tap();
  await expect(page).toHaveURL(new RegExp(`/journals/${journalId}\\?deleted=entry-soft$`));
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.entryMovedToTrash);
  await expect(page.locator("main:visible li")).toHaveCount(9);
  await expect(page.getByRole("link", { name: "New entry", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("main:visible li")).toHaveCount(9);
  await page.goto(`/journals/${journalId}/entries/new`);
  await page.getByLabel("Your entry", { exact: true }).fill("Another entry.");
  await page.getByRole("button", { name: "Save entry", exact: true }).tap();
  await expect(page.locator("#form-error")).toHaveText(dictionaries.en.journalFull);
  await page.goto(detail());
  await expect(
    page.getByRole("heading", { name: dictionaries.en.journalNotFound, exact: true }),
  ).toBeVisible();
});

test("permanent entry deletion warns with its date, traps focus, cancels and then removes the entry", async ({
  page,
}) => {
  await page.goto(detail());
  await page.getByRole("button", { name: "Get feedback", exact: true }).tap();
  await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackReady);
  const trigger = page.getByRole("button", { name: dictionaries.en.entryActions, exact: true });
  await trigger.tap();
  await page.getByRole("menuitem", { name: "Delete forever", exact: true }).tap();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("November 1, 2026");
  await expect(dialog).toContainText("cannot be restored");
  await mobileChecks(page);
  await page.getByRole("button", { name: "Cancel", exact: true }).tap();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.tap();
  await page.getByRole("menuitem", { name: "Delete forever", exact: true }).tap();
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
  await expect(page.locator("main:visible li")).toHaveCount(9);
  const sql = postgres(testDatabaseUrl());
  try {
    expect(await sql`select id from entries where id = ${entries[0].id}`).toHaveLength(0);
    expect(await sql`select id from feedback where entry_id = ${entries[0].id}`).toHaveLength(0);
  } finally {
    await sql.end();
  }
  await page.goto(detail());
  await expect(
    page.getByRole("heading", { name: dictionaries.en.journalNotFound, exact: true }),
  ).toBeVisible();
});

for (const mode of ["soft", "hard"]) {
  test(`${mode} journal deletion removes the journal and prevents opening its entries`, async ({
    page,
  }) => {
    await page.goto(`/journals/${journalId}`);
    if (mode === "soft") {
      await page.getByRole("button", { name: dictionaries.en.journalActions, exact: true }).tap();
      await page.getByRole("menuitem", { name: "Move to trash", exact: true }).tap();
    } else {
      await page.getByRole("button", { name: /actions$/i }).tap();
      await page.getByRole("menuitem", { name: "Delete forever", exact: true }).tap();
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
    await expect(
      page.getByRole("heading", { name: dictionaries.en.journalNotFound, exact: true }),
    ).toBeVisible();
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
