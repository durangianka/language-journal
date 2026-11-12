import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { locales } from "../../src/config/locales";
import { dictionaries } from "../../src/i18n/dictionaries";
import { today } from "../../src/lib/journal/dates";
import { testDatabaseUrl } from "../support/test-database-url";

const screenshotDirectory = "docs/screenshots/app-visible-gaps";

async function touchTargets(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const control of await page.locator("button:visible, a[href]:visible").all()) {
    await expect
      .poll(async () => (await control.boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(44);
    await expect
      .poll(async () => (await control.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(44);
  }
}

for (const locale of locales) {
  test(`Jev and first-save feedback use the ${locale} interface at 375px`, async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    if (!baseURL) throw new Error("Browser base URL missing");
    await context.addCookies([{ name: "locale", value: locale, url: baseURL }]);
    const t = dictionaries[locale];
    const journalId = randomUUID();
    const sql = postgres(testDatabaseUrl());
    const requests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/jev") requests.push(request.url());
    });
    try {
      await sql`insert into journals (id, language, level) values (${journalId}, 'en', 'basic')`;
      await page.goto(`/journals/${journalId}/entries/new?date=2026-02-30`);
      await expect(page.locator('input[name="entryDate"]')).toHaveValue(today());
      const body = page.getByRole("textbox", { name: t.yourEntry, exact: true });
      const date = page.getByRole("button", { name: t.entryDate, exact: true });
      await body.fill("I goes.");
      await date.focus();
      await expect(page.locator("#jev-note")).toBeEmpty();
      expect(requests).toHaveLength(0);
      await body.fill("I goes to school every morning and read a book about travelling.");
      await date.focus();
      await expect(page.locator("#jev-note")).toHaveText(`${t.grammar}. ${t.jevDetails}`);
      await page.screenshot({
        path: `${screenshotDirectory}/jev-${locale}-375.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: t.saveEntry, exact: true }).click();
      await expect(page.getByRole("status")).toHaveText(t.feedbackReady);
      await expect(
        page.getByRole("button", { name: t.getFeedbackAgain, exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: t.editEntry, exact: true }).click();
      await expect(page.getByRole("textbox", { name: t.yourEntry, exact: true })).toHaveValue(
        "I goes to school every morning and read a book about travelling.",
      );
      await page.getByRole("button", { name: t.cancel, exact: true }).click();
      await expect(page.getByRole("textbox", { name: t.yourEntry, exact: true })).toHaveCount(0);
    } finally {
      await sql`delete from journals where id = ${journalId}`;
      await sql.end();
    }
  });
}

for (const width of [375, 1280]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, hasTouch: true });
    test("first save, editing, insight, calendar, actions and literal formula text", async ({
      page,
    }) => {
      test.setTimeout(60_000);
      const sql = postgres(testDatabaseUrl());
      let journalId = "";
      try {
        await page.goto("/journals/new");
        await page
          .getByRole("group", { name: "Choose a language", exact: true })
          .getByRole("button", { name: "English", exact: true })
          .click();
        await page.getByRole("radio", { name: "Basic · A2", exact: true }).check();
        await page.getByRole("button", { name: "Create journal", exact: true }).click();
        await expect(page).toHaveURL(/\/journals\/[a-f0-9-]+$/);
        journalId = new URL(page.url()).pathname.split("/")[2];
        await expect(page.getByLabel("Journal insight", { exact: true })).toContainText(
          "Your insight appears after your first feedback.",
        );
        await page.screenshot({
          path: `${screenshotDirectory}/insight-empty-${width}.png`,
          fullPage: true,
        });
        await page.getByRole("link", { name: "New entry", exact: true }).click();
        await expect(page.locator('input[name="entryDate"]')).toHaveValue(today());
        await page.getByRole("button", { name: "Entry date", exact: true }).tap();
        const picker = page.locator('[data-slot="popover-content"]');
        await expect(picker).toBeVisible();
        await touchTargets(page);
        await page.screenshot({
          path: `${screenshotDirectory}/calendar-${width}.png`,
          fullPage: true,
        });
        await picker.locator('button[data-day="11/10/2026"]').click();
        await expect(picker).toBeHidden();
        await expect(page.locator('input[name="entryDate"]')).toHaveValue("2026-11-10");
        const original = String.raw`I goes to school every morning. I also write formula markup: \(x^2 + y^2\) and \[z = 1\].`;
        const corrected = original.replace("I goes", "I go");
        await page.getByRole("textbox", { name: "Your entry", exact: true }).fill(original);
        await page.getByRole("button", { name: "Entry date", exact: true }).focus();
        await expect(page.locator("#jev-note")).toHaveText(
          "Grammar. Get feedback gives the detail.",
        );
        await touchTargets(page);
        await page.screenshot({ path: `${screenshotDirectory}/jev-${width}.png`, fullPage: true });
        await page.getByRole("button", { name: "Save entry", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/journals/${journalId}/entries/[a-f0-9-]+$`));
        const entryUrl = new URL(page.url()).pathname;
        const entryId = entryUrl.split("/").at(-1);
        if (!entryId) throw new Error("Saved entry ID missing");
        await expect(page.getByRole("status")).toHaveText("Preparing your feedback…");
        await page.screenshot({
          path: `${screenshotDirectory}/feedback-pending-${width}.png`,
          fullPage: true,
        });
        await expect(page.getByRole("status")).toHaveText("Your feedback is ready.");
        await expect(page.getByText(corrected, { exact: true })).toBeVisible();
        await expect(page.locator("math, .katex, mjx-container")).toHaveCount(0);
        await touchTargets(page);
        await page.screenshot({
          path: `${screenshotDirectory}/feedback-ready-formula-${width}.png`,
          fullPage: true,
        });
        await page.getByRole("button", { name: "Entry actions", exact: true }).click();
        await touchTargets(page);
        await page.screenshot({
          path: `${screenshotDirectory}/actions-${width}.png`,
          fullPage: true,
        });
        await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
        await expect(page.getByRole("textbox", { name: "Your entry", exact: true })).toHaveValue(
          original,
        );
        await page
          .getByRole("textbox", { name: "Your entry", exact: true })
          .fill("Discard these changes.");
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await page.getByRole("button", { name: "Edit", exact: true }).click();
        await expect(page.getByRole("textbox", { name: "Your entry", exact: true })).toHaveValue(
          original,
        );
        const edited = original + " Today I read a new story.";
        await page.getByRole("textbox", { name: "Your entry", exact: true }).fill(edited);
        await page.getByRole("button", { name: "Entry date", exact: true }).click();
        await picker.locator('button[data-day="11/9/2026"]').click();
        await expect(picker).toBeHidden();
        await touchTargets(page);
        await page.screenshot({
          path: `${screenshotDirectory}/editing-${width}.png`,
          fullPage: true,
        });
        await page.getByRole("button", { name: "Save entry", exact: true }).click();
        await expect(page.getByRole("textbox", { name: "Your entry", exact: true })).toHaveCount(0);
        await expect(page).toHaveURL(new RegExp(`${entryUrl}$`));
        await expect(page.locator("main time").first()).toHaveText("November 9, 2026");
        await expect(
          page.getByRole("button", { name: "Get feedback again", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText(dictionaries.en.feedbackOutdated, { exact: true }),
        ).toBeVisible();
        const [saved] =
          await sql`select body, entry_date::text, updated_at > created_at as edited from entries where id = ${entryId}`;
        expect(saved).toMatchObject({ body: edited, entry_date: "2026-11-09", edited: true });
        const history = await sql`select id from feedback where entry_id = ${entryId}`;
        expect(history).toHaveLength(1);
        await page.screenshot({
          path: `${screenshotDirectory}/edited-no-auto-feedback-${width}.png`,
          fullPage: true,
        });
        for (let count = 0; count < 2; count++) {
          await page.getByRole("button", { name: "Get feedback again", exact: true }).click();
          await expect(page.getByRole("status")).toHaveText("Preparing your feedback…");
          await expect(page.getByRole("status")).toHaveText("Your feedback is ready.");
        }
        await page.getByRole("button", { name: "Get feedback again", exact: true }).click();
        await expect(page.getByRole("status")).toContainText(dictionaries.en.entry_limit_reached);
        expect(await sql`select id from feedback where entry_id = ${entryId}`).toHaveLength(3);
        await page.reload();
        await expect(
          page.getByText(edited.replace("I goes", "I go"), { exact: true }),
        ).toBeVisible();
        await page.getByRole("link", { name: "Back to journal", exact: true }).click();
        await expect(page.getByLabel("Journal insight", { exact: true })).toContainText(
          "Grammar: 3",
        );
        await page.screenshot({
          path: `${screenshotDirectory}/insight-after-feedback-${width}.png`,
          fullPage: true,
        });
        await page.goto(entryUrl);
        await page.getByRole("button", { name: "Entry actions", exact: true }).click();
        await page.getByRole("menuitem", { name: "Move to trash", exact: true }).click();
        await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
        await page.screenshot({
          path: `${screenshotDirectory}/trash-undo-${width}.png`,
          fullPage: true,
        });
        const [trashed] = await sql`select deleted_at from entries where id = ${entryId}`;
        expect(trashed.deleted_at).not.toBeNull();
        await page.getByRole("button", { name: "Undo", exact: true }).click();
        await expect(page.locator(`a[href="${entryUrl}"]`)).toBeVisible();
        await page.goto(entryUrl);
        await page.getByRole("button", { name: "Entry actions", exact: true }).click();
        await page
          .getByRole("menuitem", { name: dictionaries.en.deletePermanently, exact: true })
          .click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await touchTargets(page);
        await page.screenshot({
          path: `${screenshotDirectory}/delete-dialog-${width}.png`,
          fullPage: true,
        });
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(
          page.getByRole("button", { name: "Entry actions", exact: true }),
        ).toBeFocused();
        await page.getByRole("button", { name: "Entry actions", exact: true }).click();
        await page
          .getByRole("menuitem", { name: dictionaries.en.deletePermanently, exact: true })
          .click();
        await page
          .getByRole("button", { name: dictionaries.en.confirmDeletePermanently, exact: true })
          .click();
        await expect(page.getByRole("status")).toHaveText(dictionaries.en.entryDeletedPermanently);
        expect(await sql`select id from entries where id = ${entryId}`).toHaveLength(0);
      } finally {
        if (journalId) await sql`delete from journals where id = ${journalId}`;
        await sql.end();
      }
    });
  });
}
