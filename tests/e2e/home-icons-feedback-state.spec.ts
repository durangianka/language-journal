import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { locales } from "../../src/config/locales";
import { dictionaries } from "../../src/i18n/dictionaries";
import { testDatabaseUrl } from "../support/test-database-url";

const screenshotDirectory = "docs/screenshots/home-icons-feedback-state";

async function touchTargets(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const control of await page
    .locator("main a[href]:visible, main button:visible, header button:visible")
    .all()) {
    await expect
      .poll(async () => (await control.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(44);
    await expect
      .poll(async () => (await control.boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(44);
  }
}

for (const width of [375, 1280]) {
  for (const locale of locales) {
    test(`home, labelled icons and automatic feedback in ${locale} at ${width}px`, async ({
      page,
      context,
      baseURL,
    }) => {
      test.setTimeout(60_000);
      if (!baseURL) throw new Error("Browser base URL missing");
      await page.setViewportSize({ width, height: 900 });
      await context.addCookies([{ name: "locale", value: locale, url: baseURL }]);
      const t = dictionaries[locale];
      const sql = postgres(testDatabaseUrl());
      let journalId = "";
      try {
        await page.goto("/");
        await expect(page.getByText(t.emptyJournals, { exact: true })).toBeVisible();
        await touchTargets(page);
        await page.screenshot({
          path: `${screenshotDirectory}/empty-${locale}-${width}.png`,
          fullPage: true,
        });
        await page.getByRole("link", { name: t.newJournal, exact: true }).click();
        await page
          .getByRole("group", { name: t.chooseLanguage, exact: true })
          .getByRole("button", { name: t.english, exact: true })
          .click();
        await page.getByRole("radio", { name: t.basic, exact: true }).check();
        await page.getByRole("button", { name: t.createJournal, exact: true }).click();
        await expect(page).toHaveURL(/\/journals\/[a-f0-9-]+$/);
        journalId = new URL(page.url()).pathname.split("/")[2];
        await page.getByRole("link", { name: t.home, exact: true }).click();
        const card = page.locator(`main:visible a[href="/journals/${journalId}"]`);
        await expect(card).toContainText(t.english);
        await expect(card).toContainText(t.basic);
        await expect(card).toContainText(t.noEntriesYet);
        await expect(card).toContainText(`${t.entries}: 0`);
        await card.click();
        await page.getByRole("link", { name: t.newEntry, exact: true }).click();
        const body = "I goes to school every morning and read a book about travelling.";
        await page.getByRole("textbox", { name: t.yourEntry, exact: true }).fill(body);
        await page.getByRole("button", { name: t.entryDate, exact: true }).focus();
        await expect(page.locator("#jev-note")).toHaveText(`${t.jevGrammar} ${t.jevDetails}`);
        await page.getByRole("button", { name: t.saveEntry, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/journals/${journalId}/entries/[a-f0-9-]+$`));
        const entryId = new URL(page.url()).pathname.split("/").at(-1);
        await expect(page.getByRole("status")).toHaveText(t.feedbackPending);
        await expect(page.getByRole("status").locator(".animate-spin")).toBeVisible();
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(2);
        await page.screenshot({
          path: `${screenshotDirectory}/pending-${locale}-${width}.png`,
          fullPage: true,
        });
        await expect(page.getByRole("status")).toHaveText(t.feedbackReady);
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
        await expect(page.getByText(body.replace("I goes", "I go"), { exact: true })).toBeVisible();
        await touchTargets(page);
        await page.screenshot({
          path: `${screenshotDirectory}/ready-${locale}-${width}.png`,
          fullPage: true,
        });
        await page.getByRole("button", { name: t.editEntry, exact: true }).click();
        await page
          .getByRole("textbox", { name: t.yourEntry, exact: true })
          .fill(`${body} I enjoy learning.`);
        await page.getByRole("button", { name: t.saveEntry, exact: true }).click();
        await expect(page.getByText(t.feedbackOutdated, { exact: true })).toBeVisible();
        await page.getByRole("tab", { name: t.originalText, exact: true }).click();
        await expect(page.getByText(body, { exact: true })).toBeVisible();
        const [saved] = await sql`select body from entries where id = ${entryId ?? ""}`;
        expect(saved.body).toBe(`${body} I enjoy learning.`);
        await page.getByRole("link", { name: t.home, exact: true }).click();
        await expect(card).toContainText(`${t.entries}: 1`);
        await expect(card.locator("time")).toHaveCount(1);
        await touchTargets(page);
        await page.screenshot({
          path: `${screenshotDirectory}/home-${locale}-${width}.png`,
          fullPage: true,
        });
        await sql`update feedback set status = 'failed', reason_code = 'provider_error' where entry_id = ${entryId ?? ""}`;
        await page.goto(`/journals/${journalId}/entries/${entryId}`);
        await expect(page.getByRole("status")).toContainText(t.feedbackFailed);
        await expect(page.getByRole("status")).toContainText(t.provider_error);
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: t.retryFeedback, exact: true }),
        ).toBeVisible();
        await page.screenshot({
          path: `${screenshotDirectory}/failed-${locale}-${width}.png`,
          fullPage: true,
        });
      } finally {
        if (journalId) await sql`delete from journals where id = ${journalId}`;
        await sql.end();
      }
    });
  }
}
