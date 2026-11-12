import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test, type Page } from "@playwright/test";
import { dictionaries } from "../../src/i18n/dictionaries";
import { locales } from "../../src/config/locales";
import { testDatabaseUrl } from "../support/test-database-url";

const directory = "docs/screenshots/visual-design";
let journalId = "";
let entryId = "";
let secondId = "";
const original = "I goes to school. I read a new story every afternoon.";

test.beforeEach(async () => {
  journalId = randomUUID();
  entryId = randomUUID();
  secondId = randomUUID();
  const sql = postgres(testDatabaseUrl());
  try {
    await sql`insert into journals (id, language, level) values (${journalId}, 'en', 'basic')`;
    await sql`insert into entries (id, journal_id, body, entry_date, created_at) values
      (${entryId}, ${journalId}, ${original}, '2026-11-10', '2026-11-10T09:15:00Z'),
      (${secondId}, ${journalId}, 'An afternoon at the library.', '2026-11-10', '2026-11-10T15:30:00Z')`;
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

async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const control of await page
    .locator("main button:visible, main a[href]:visible, header button:visible")
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
  for (const colorScheme of ["light", "dark"]) {
    test(`${width}px ${colorScheme}: every screen, loading, actions, trash and undo`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      if (colorScheme !== "light" && colorScheme !== "dark") throw new Error("Unsupported theme");
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      async function capture(name: string) {
        await fits(page);
        await page.screenshot({
          path: `${directory}/${name}-${width}-${colorScheme}.png`,
          fullPage: true,
        });
      }
      await page.goto("/");
      await expect(page.locator(`a[href="/journals/${journalId}"]`)).toBeVisible();
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        colorScheme === "light" ? "rgb(251, 247, 241)" : "rgb(26, 21, 18)",
      );
      await capture("home");
      await page.goto("/journals");
      await expect(
        page.locator(`a[href="/journals/${journalId}/entries/${entryId}"]`),
      ).toContainText("I goes to school.");
      await capture("journals");
      await page.goto("/journals/new");
      await expect(page.getByText("Journal language", { exact: true })).toBeVisible();
      await capture("create-journal");
      await page.getByRole("button", { name: "Create journal", exact: true }).click();
      await expect(page.locator("#language-error")).toHaveText(dictionaries.en.invalidLanguage);
      await expect(page.locator("#level-error")).toHaveText(dictionaries.en.invalidLevel);
      await expect(
        page
          .getByRole("group", { name: "Choose a language", exact: true })
          .getByRole("button")
          .first(),
      ).toBeFocused();
      await capture("create-errors");
      await page.goto(`/journals/${journalId}`);
      await expect(page.locator(`a[href$="/${entryId}"] time`)).toHaveText("09:15 AM");
      await expect(page.locator(`a[href$="/${secondId}"] time`)).toHaveText("03:30 PM");
      await expect(page.locator(`a[href$="/${entryId}"] p`)).toHaveCSS("font-weight", "600");
      await page.getByRole("button", { name: "Browse by date", exact: true }).click();
      await capture("journal");
      await page.getByRole("link", { name: "New entry", exact: true }).click();
      const hints = page.getByRole("region", { name: "Sentence structures", exact: true });
      await expect(hints.locator("li:visible")).toHaveCount(width === 375 ? 1 : 4);
      await capture("writing");
      if (width === 375) {
        await hints.getByRole("button", { name: "See more", exact: true }).click();
        await expect(hints.locator("li:visible")).toHaveCount(4);
        await capture("writing-hints");
      }
      await page.getByLabel("Your entry", { exact: true }).fill(original);
      await page.getByRole("button", { name: "Entry date", exact: true }).focus();
      await expect(page.locator("#jev-note")).toHaveText(
        "Possible grammar issue Get feedback to see the fix",
      );
      await capture("writing-jev");
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("link", { name: "Back to journal", exact: true }).click();
      const sql = postgres(testDatabaseUrl());
      try {
        await sql`insert into feedback (entry_id, analysed_text, locale, status, model, prompt_version)
          values (${entryId}, ${original}, 'en', 'pending', 'fake', 'test')`;
        await page.goto(`/journals/${journalId}/entries/${entryId}`);
        await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackPending);
        await capture("entry-loading");
        await sql`update feedback set status='ready', corrected_text='I go to school. I read a new story every afternoon.', corrections=${sql.json([{ original: "I goes", fix: "I go", category: "grammar", explanation: "Use the base form after I." }])} where entry_id=${entryId}`;
        await expect(page.getByRole("status")).toHaveText(dictionaries.en.feedbackReady);
        await expect(page.locator('[data-slot="badge"][data-variant="grammar"]')).toHaveText(
          "Grammar",
        );
        await capture("entry");
        await page.getByRole("tab", { name: "Original", exact: true }).click();
        await capture("entry-original");
        await page.getByRole("button", { name: "Entry actions", exact: true }).click();
        await capture("entry-actions");
        await page.getByRole("menuitem", { name: "Move to trash", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/journals/${journalId}\\?deleted=entry-soft$`));
        await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
        await expect(page.locator("[data-sonner-toast]")).toHaveCSS(
          "background-color",
          colorScheme === "light" ? "rgb(42, 33, 28)" : "rgb(245, 238, 230)",
        );
        await capture("undo");
        await page.getByRole("button", { name: "Undo", exact: true }).click();
        await expect(page.locator(`a[href$="/${entryId}"]`)).toBeVisible();
        await page.goto(`/journals/${journalId}/entries/${entryId}`);
        await page.getByRole("button", { name: "Entry actions", exact: true }).click();
        await page.getByRole("menuitem", { name: "Move to trash", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/journals/${journalId}\\?deleted=entry-soft$`));
        await page.goto("/trash");
        await expect(page.getByRole("button", { name: "Restore", exact: true })).toBeVisible();
        await capture("trash");
        await page.getByRole("button", { name: "Empty trash", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
        await capture("trash-confirm");
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await page.getByRole("button", { name: "Restore", exact: true }).click();
        await expect(page.getByText(dictionaries.en.trashEmpty, { exact: true })).toBeVisible();
        await capture("trash-empty");
        await page.goto("/settings");
        await expect(
          page.getByRole("button", { name: "Save settings", exact: true }),
        ).toBeVisible();
        await capture("settings");
      } finally {
        await sql.end();
      }
    });
  }
}

for (const locale of locales) {
  test(`${locale}: inline errors and unsaved writing protect links, interface changes, Back and reload`, async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(45_000);
    if (!baseURL) throw new Error("Missing base URL");
    await context.addCookies([{ name: "locale", value: locale, url: baseURL }]);
    const t = dictionaries[locale];
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/journals/new");
    await page.getByRole("button", { name: t.createJournal, exact: true }).click();
    await expect(page.locator("#language-error")).toHaveText(t.invalidLanguage);
    await expect(page.locator("#level-error")).toHaveText(t.invalidLevel);
    await page
      .getByRole("group", { name: t.chooseLanguage, exact: true })
      .getByRole("button")
      .first()
      .click();
    await page.getByRole("button", { name: t.createJournal, exact: true }).click();
    await expect(page.getByRole("radio").first()).toBeFocused();
    await page.goto(`/journals/${journalId}`);
    await page.getByRole("link", { name: t.newEntry, exact: true }).click();
    const body = page.getByLabel(t.yourEntry, { exact: true });
    await body.fill("Keep this unsaved writing.");
    async function rejectLeave(action: () => Promise<unknown>) {
      const shown = page.waitForEvent("dialog");
      page.once("dialog", (dialog) => dialog.dismiss());
      await action();
      expect((await shown).message()).toBe(t.unsavedChanges);
      await expect(body).toHaveValue("Keep this unsaved writing.");
    }
    await rejectLeave(() => page.getByRole("link", { name: t.backToJournal, exact: true }).click());
    await rejectLeave(() =>
      page
        .getByRole("navigation", { name: t.interfaceLanguage, exact: true })
        .getByRole("button")
        .last()
        .click(),
    );
    await rejectLeave(() => page.evaluate(() => history.back()));
    const unloaded = page.waitForEvent("dialog");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.evaluate(() => location.reload());
    expect((await unloaded).type()).toBe("beforeunload");
    await expect(body).toHaveValue("Keep this unsaved writing.");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("link", { name: t.backToJournal, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/journals/${journalId}$`));
  });
}

test("trash restores a journal batch and permanently empties only deleted entries after confirmation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/journals/${journalId}`);
  await page.getByRole("button", { name: "Journal actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Move to trash", exact: true }).click();
  await expect(page).toHaveURL(/\/journals\?deleted=journal-soft$/);
  await page.goto("/trash");
  await expect(page.getByRole("button", { name: "Restore", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText(dictionaries.en.trashEmpty, { exact: true })).toBeVisible();
  await page.goto(`/journals/${journalId}`);
  await expect(page.locator(`a[href$="/${entryId}"]`)).toBeVisible();
  await expect(page.locator(`a[href$="/${secondId}"]`)).toBeVisible();
  await page.goto(`/journals/${journalId}/entries/${entryId}`);
  await page.getByRole("button", { name: "Entry actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Move to trash", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/journals/${journalId}\\?deleted=entry-soft$`));
  await page.goto("/trash");
  await page.getByRole("button", { name: "Empty trash", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restore", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Empty trash", exact: true }).click();
  await page
    .getByRole("button", { name: dictionaries.en.confirmDeletePermanently, exact: true })
    .click();
  await expect(page.getByText(dictionaries.en.trashEmpty, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(dictionaries.en.trashEmpty, { exact: true })).toBeVisible();
  const sql = postgres(testDatabaseUrl());
  try {
    expect(await sql`select id from entries where id=${entryId}`).toHaveLength(0);
    expect(
      await sql`select id from entries where id=${secondId} and deleted_at is null`,
    ).toHaveLength(1);
    expect(
      await sql`select id from journals where id=${journalId} and deleted_at is null`,
    ).toHaveLength(1);
  } finally {
    await sql.end();
  }
});
