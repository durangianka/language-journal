import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test, type Page } from "@playwright/test";
import { testDatabaseUrl } from "../support/test-database-url";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

let journalId = "";
let entryId = "";
test.beforeEach(async () => {
  journalId = randomUUID();
  entryId = randomUUID();
  const sql = postgres(testDatabaseUrl());
  try {
    await sql`insert into journals (id, language, level) values (${journalId}, 'en', 'basic')`;
    await sql`insert into entries (id, journal_id, body, entry_date) values (${entryId}, ${journalId}, 'I goes to school. Yesterday I read a story.', '2026-11-10')`;
    await sql`insert into entries (journal_id, body, entry_date) values (${journalId}, 'An afternoon of reading.', '2026-11-10')`;
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

async function fit(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("calendar finds entries and an empty day starts a dated entry at 375px", async ({ page }) => {
  await page.goto(`/journals/${journalId}`);
  const toggle = page.getByRole("button", { name: "Browse by date", exact: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.tap();
  const day = page.locator(".calendar-multiple-day button");
  await expect(day).toHaveCount(1);
  const box = await day.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await day.tap();
  await expect(page.locator("#entries-2026-11-10")).toBeInViewport();
  await fit(page);
  await page.screenshot({ path: "docs/screenshots/ui-redesign/journal-375.png", fullPage: true });
  await page.locator('button[data-day="11/12/2026"]').tap();
  await expect(page.getByText("No entries on this day.", { exact: true })).toBeVisible();
  await page.locator(`a[href="/journals/${journalId}/entries/new?date=2026-11-12"]`).tap();
  await expect(page.locator('input[name="entryDate"]')).toHaveValue("2026-11-12");
  await page.getByLabel("Your entry", { exact: true }).fill("Today I read a new story in English.");
  await expect(page.getByText("8 words", { exact: true })).toBeVisible();
  const save = page.getByRole("button", { name: "Save entry", exact: true });
  await expect(save).toBeInViewport();
  await fit(page);
  await page.screenshot({ path: "docs/screenshots/ui-redesign/writing-375.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 420 });
  await page.getByLabel("Your entry", { exact: true }).focus();
  await expect(save).toBeInViewport();
});

test("language toggles, corrected tabs and the first correction are usable at 375px", async ({
  page,
}) => {
  await page.goto("/journals/new");
  await page
    .getByRole("group", { name: "Choose a language", exact: true })
    .getByRole("button", { name: "English", exact: true })
    .tap();
  await page.getByRole("radio", { name: "Basic · A2", exact: true }).check();
  await expect(page.getByRole("button", { name: "Travel", exact: true })).toBeEnabled();
  await fit(page);
  await page.screenshot({
    path: "docs/screenshots/ui-redesign/create-journal-375.png",
    fullPage: true,
  });
  await page.goto(`/journals/${journalId}/entries/${entryId}`);
  await page.getByRole("button", { name: "Get feedback", exact: true }).tap();
  await expect(page.getByRole("status")).toHaveText("Your feedback is ready.");
  await expect(page.getByRole("tab", { name: "Corrected text", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator('[data-slot="accordion-trigger"]').first()).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await fit(page);
  await page.screenshot({ path: "docs/screenshots/ui-redesign/entry-375.png", fullPage: true });
  await page.getByRole("tab", { name: "Original", exact: true }).tap();
  await expect(
    page.getByText("I goes to school. Yesterday I read a story.", { exact: true }),
  ).toBeVisible();
});

for (const kind of ["entry", "journal"]) {
  test(`${kind} Undo restores persisted data after navigation`, async ({ page }) => {
    await page.goto(
      kind === "entry" ? `/journals/${journalId}/entries/${entryId}` : `/journals/${journalId}`,
    );
    await page
      .getByRole("button", {
        name: kind === "entry" ? "Entry actions" : "Journal actions",
        exact: true,
      })
      .tap();
    await page.getByRole("menuitem", { name: "Move to trash", exact: true }).tap();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page).toHaveURL(
      kind === "entry"
        ? new RegExp(`/journals/${journalId}\\?deleted=entry-soft$`)
        : /\/journals\?deleted=journal-soft$/,
    );
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    await expect
      .poll(async () => (await undo.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(44);
    await expect
      .poll(async () => (await undo.boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(44);
    await undo.tap();
    await expect(page).toHaveURL(new RegExp(`/journals/${journalId}$`));
    await expect(page.locator(`a[href="/journals/${journalId}/entries/${entryId}"]`)).toBeVisible();
    await page.reload();
    await expect(page.locator(`a[href="/journals/${journalId}/entries/${entryId}"]`)).toBeVisible();
  });
}
