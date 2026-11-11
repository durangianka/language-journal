import "dotenv/config";
import postgres from "postgres";
import { expect, test, type Page } from "@playwright/test";
import { today } from "../../src/lib/journal/dates";
import { testDatabaseUrl } from "../support/test-database-url";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

let createdJournalId: string | undefined;
test.afterEach(async () => {
  const id = createdJournalId;
  createdJournalId = undefined;
  if (!id) return;
  const sql = postgres(testDatabaseUrl());
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
  for (const name of ["Travel", "Work"])
    await page.getByRole("button", { name, exact: true }).tap();
  await expect(page.getByRole("button", { name: "Grammar", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Grammar", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator("#focus-limit")).toHaveText(
    "You have reached the focus limit for this level.",
  );
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
  await expect(date).toHaveValue(today());
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

for (const { timezoneId, instant, day, label } of [
  {
    timezoneId: "America/Los_Angeles",
    instant: "2026-01-02T00:30:00Z",
    day: "2026-01-01",
    label: "January 1, 2026",
  },
  {
    timezoneId: "Pacific/Kiritimati",
    instant: "2026-01-01T23:30:00Z",
    day: "2026-01-02",
    label: "January 2, 2026",
  },
]) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId });

    test("defaults to the device calendar day and preserves it after save and reload", async ({
      page,
    }) => {
      await page.clock.setFixedTime(new Date(instant));
      await page.goto("/journals/new");
      await page.getByRole("radio", { name: "English", exact: true }).check();
      await page.getByRole("radio", { name: "New · A1", exact: true }).check();
      await page.getByRole("button", { name: "Create journal", exact: true }).tap();
      await expect(page).toHaveURL(/\/journals\/[a-f0-9-]+$/);
      createdJournalId = new URL(page.url()).pathname.split("/")[2];
      await page.getByRole("link", { name: "New entry", exact: true }).tap();
      await expect(page.getByLabel("Entry date", { exact: true })).toHaveValue(day);
      await page.reload();
      await expect(page.getByLabel("Entry date", { exact: true })).toHaveValue(day);
      await page.getByLabel("Your entry", { exact: true }).fill("A local calendar day.");
      await page.getByRole("button", { name: "Save entry", exact: true }).tap();
      await expect(page.getByRole("status")).toHaveText(`New entry saved${label}`);
      await expect(page.locator("main:visible time")).toHaveText(label);
      await expect(page.locator("main:visible time")).toHaveAttribute("datetime", day);
      await page.reload();
      await expect(page.locator("main:visible time")).toHaveText(label);
    });
  });
}

async function rejectInsert(table: "journals" | "entries", action: () => Promise<void>) {
  const sql = postgres(testDatabaseUrl(), { max: 1 });
  try {
    // The browser still invokes the real action. Postgres rejects its INSERT.
    await sql`create function test_reject_insert() returns trigger language plpgsql as $$
      begin raise exception 'Test database write failure'; end;
    $$`;
    try {
      await sql`create trigger test_reject_insert before insert on ${sql(table)}
        for each row execute function test_reject_insert()`;
      try {
        await action();
      } finally {
        await sql`drop trigger test_reject_insert on ${sql(table)}`;
      }
    } finally {
      await sql`drop function test_reject_insert()`;
    }
  } finally {
    await sql.end();
  }
}

test("failed actions keep journal language and level and entry fields for retry", async ({
  page,
}) => {
  await page.goto("/journals/new");
  const language = page.getByRole("radio", { name: "Spanish", exact: true });
  const level = page.getByRole("radio", { name: "Basic · A2", exact: true });
  await language.check();
  await level.check();
  await page.getByRole("button", { name: "Travel", exact: true }).tap();
  await rejectInsert("journals", async () => {
    await page.getByRole("button", { name: "Create journal", exact: true }).tap();
    await expect(page.locator("#form-error")).toHaveText(
      "We could not save this. Your writing is still here. Please try again.",
    );
  });
  await expect(language).toBeChecked();
  await expect(level).toBeChecked();
  await expect(page.getByRole("button", { name: "Travel", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Create journal", exact: true }).tap();
  await expect(page).toHaveURL(/\/journals\/[a-f0-9-]+$/);
  createdJournalId = new URL(page.url()).pathname.split("/")[2];
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Spanish");
  await expect(page.locator("main:visible")).toContainText("Basic · A2");

  await page.getByRole("link", { name: "New entry", exact: true }).tap();
  const date = page.getByLabel("Entry date", { exact: true });
  const body = page.getByLabel("Your entry", { exact: true });
  await date.fill("2026-11-09");
  await body.fill("Hoy escribo en español.");
  await rejectInsert("entries", async () => {
    await page.getByRole("button", { name: "Save entry", exact: true }).tap();
    await expect(page.locator("#form-error")).toBeVisible();
  });
  await expect(date).toHaveValue("2026-11-09");
  await expect(body).toHaveValue("Hoy escribo en español.");
  await page.getByRole("button", { name: "Save entry", exact: true }).tap();
  await expect(page.getByRole("status")).toHaveText("New entry savedNovember 9, 2026");
  await expect(page.locator("main:visible li")).toContainText("Hoy escribo en español.");
});

test("changing levels updates capacity and preserves the first chosen focus areas", async ({
  page,
}) => {
  await page.goto("/journals/new");
  await page.locator('input[name="level"][value="advanced"]').check();
  for (const name of ["Grammar", "Food", "Travel"])
    await page.getByRole("button", { name, exact: true }).tap();
  await expect(page.getByRole("button", { name: "Work", exact: true })).toBeDisabled();
  await page.locator('input[name="level"][value="new"]').check();
  await expect(page.locator('input[name="focus"]')).toHaveCount(1);
  await expect(page.locator('input[name="focus"]')).toHaveValue("grammar");
  await page.locator('input[name="level"][value="basic"]').check();
  await expect(page.getByRole("button", { name: "Food", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Food", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Travel", exact: true })).toBeDisabled();
});

for (const { locale, names, message } of [
  {
    locale: "en",
    names: ["Travel", "Work"],
    message: "You have reached the focus limit for this level.",
  },
  {
    locale: "es",
    names: ["Viajes", "Trabajo"],
    message: "Has alcanzado el límite de áreas para este nivel.",
  },
  {
    locale: "it",
    names: ["Viaggi", "Lavoro"],
    message: "Hai raggiunto il limite di aree per questo livello.",
  },
]) {
  test(`New level blocks an extra focus chip in ${locale}`, async ({ page, context }) => {
    await context.addCookies([{ name: "locale", value: locale, url: "http://127.0.0.1:3100" }]);
    await page.goto("/journals/new");
    await expect(page.locator("fieldset button[aria-pressed]")).toHaveCount(6);
    await page.locator('input[name="level"][value="new"]').check();
    const [first, second] = names.map((name) => page.getByRole("button", { name, exact: true }));
    await first.tap();
    await expect(second).toBeDisabled();
    await expect(second).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('fieldset button[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('input[name="focus"]')).toHaveCount(1);
    await expect(page.locator("#focus-limit")).toHaveText(message);
    await first.tap();
    await expect(page.locator("#focus-limit")).toBeEmpty();
    await expect(second).toBeEnabled();
    await second.tap();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await second.tap();
    await expect(page.locator('input[name="focus"]')).toHaveCount(0);
  });
}
