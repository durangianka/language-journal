import "dotenv/config";
import postgres from "postgres";
import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

let createdJournalId: string | undefined;
test.afterEach(async () => {
  const id = createdJournalId;
  createdJournalId = undefined;
  if (!id) return;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for browser test cleanup");
  const sql = postgres(url);
  try {
    await sql`delete from journals where id = ${id}`;
  } finally {
    await sql.end();
  }
});

async function checkTouchTargets(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  for (const target of await page
    .locator(
      'a[href]:visible, button:visible, input:not([type="hidden"]):visible, textarea:visible, label:visible',
    )
    .all()) {
    const box = await target.boundingBox();
    expect(box, await target.evaluate((element) => element.outerHTML)).not.toBeNull();
    if (!box) throw new Error("Missing interactive element");
    expect(
      box.height,
      await target.evaluate((element) => element.outerHTML),
    ).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
}

test("creates a journal and saves an entry on a 375px touch screen", async ({ page }) => {
  await page.goto("/journals");
  await checkTouchTargets(page);
  await page.screenshot({ path: "docs/screenshots/journal-pages/journals.png", fullPage: true });
  await page.getByRole("link", { name: "New journal", exact: true }).tap();
  await page.getByRole("radio", { name: "English", exact: true }).check();
  await expect(
    page.getByText("About CEFR A2, for example Cambridge A2 Key.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Basic · A2", exact: true }).check();
  for (const name of ["Travel", "Work", "Grammar"])
    await page.getByRole("button", { name, exact: true }).tap();
  await expect(page.getByRole("button", { name: "Vocabulary", exact: true })).toBeDisabled();
  await checkTouchTargets(page);
  await page.screenshot({ path: "docs/screenshots/journal-pages/new-journal.png", fullPage: true });
  await page.getByRole("button", { name: "Create journal", exact: true }).tap();
  await expect(page).toHaveURL(/\/journals\/[a-f0-9-]+$/);
  const journalUrl = page.url();
  createdJournalId = new URL(journalUrl).pathname.split("/")[2];
  await expect(
    page.getByText("Your journal is ready. Choose New entry to start writing."),
  ).toBeVisible();
  await checkTouchTargets(page);
  await page.screenshot({ path: "docs/screenshots/journal-pages/journal.png", fullPage: true });
  await page.getByRole("link", { name: "New entry", exact: true }).tap();
  const date = page.getByLabel("Entry date", { exact: true });
  const today = await page.evaluate(() => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  });
  await expect(date).toHaveValue(today);
  await date.fill("2026-11-10");
  await page
    .getByLabel("Your entry", { exact: true })
    .fill("Today I practised writing in English.");
  await expect(page.getByText("37 / 5000 characters", { exact: true })).toBeVisible();
  await checkTouchTargets(page);
  await page.screenshot({ path: "docs/screenshots/journal-pages/new-entry.png", fullPage: true });
  await page.getByRole("button", { name: "Save entry", exact: true }).tap();
  await expect(page.getByRole("status")).toHaveText("New entry savedNovember 10, 2026");
  await expect(page).toHaveURL(journalUrl);
  await expect(page.locator("main:visible li")).toHaveCount(1);
  await expect(page.locator("main:visible li").first()).toContainText(
    "Today I practised writing in English.",
  );
  await checkTouchTargets(page);
  await page.screenshot({ path: "docs/screenshots/journal-pages/saved-entry.png", fullPage: true });
  await page.reload();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator("main:visible li")).toHaveCount(1);

  // A backdated entry stays below the first one, even though it was created later.
  await page.getByRole("link", { name: "New entry", exact: true }).tap();
  await page.getByLabel("Entry date", { exact: true }).fill("2026-11-09");
  await page.getByLabel("Your entry", { exact: true }).fill("Yesterday I read a short story.");
  await page.getByRole("button", { name: "Save entry", exact: true }).tap();
  await expect(page.locator("main:visible li")).toHaveCount(2);
  await expect(page.locator("main:visible li").first()).toContainText("Today I practised");
  await expect(page.locator("main:visible li").last()).toContainText("Yesterday I read");
  await page.goto("/journals");
  await page.locator(`a[href="${new URL(journalUrl).pathname}"]`).tap();
  await expect(page.locator("main:visible li")).toHaveCount(2);
});

test("entry limits count Unicode characters and show server validation without losing writing", async ({
  page,
}) => {
  await page.goto("/journals/new");
  await page.getByRole("radio", { name: "English", exact: true }).check();
  await page.getByRole("radio", { name: "New · A1", exact: true }).check();
  await page.getByRole("button", { name: "Create journal", exact: true }).tap();
  await expect(page).toHaveURL(/\/journals\/[a-f0-9-]+$/);
  createdJournalId = new URL(page.url()).pathname.split("/")[2];
  await page.getByRole("link", { name: "New entry", exact: true }).tap();
  const body = page.getByLabel("Your entry", { exact: true });
  await body.fill("😀".repeat(5001));
  await expect(body).toHaveValue("😀".repeat(5000));
  await expect(page.getByText("5000 / 5000 characters", { exact: true })).toBeVisible();
  await body.fill("   ");
  await page.getByRole("button", { name: "Save entry", exact: true }).tap();
  await expect(page.locator("#body-error")).toHaveText(
    "Write between 1 and 5000 characters. Your entry cannot be blank.",
  );
  await expect(body).toHaveValue("   ");
});

test("invalid and missing journals show the not-found screen", async ({ page }) => {
  for (const path of [
    "/journals/invalid",
    "/journals/00000000-0000-4000-8000-000000000000/entries/new",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Journal unavailable", exact: true }),
    ).toBeVisible();
  }
});
