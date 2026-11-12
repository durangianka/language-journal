import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { testDatabaseUrl } from "../support/test-database-url";

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

test("short Spanish spelling badge stays above the text box at 375px and retries on each blur", async ({
  page,
}) => {
  const journalId = randomUUID();
  const sql = postgres(testDatabaseUrl());
  let release = () => {};
  let calls = 0;
  let note: { issue: string; confidence: number } | null = { issue: "spelling", confidence: 0.5 };
  let gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await sql`insert into journals (id, language, level) values (${journalId}, 'es', 'basic')`;
    await page.route("**/api/jev", async (route) => {
      calls += 1;
      await gate;
      await route.fulfill({ json: note });
    });
    await page.goto(`/journals/${journalId}/entries/new`);
    const body = page.locator("#entry-body");
    const hint = page.locator("#jev-note");
    const save = page.getByRole("button", { name: "Save entry", exact: true });
    await body.fill("1234567");
    await save.focus();
    await expect(hint).toBeEmpty();
    expect(calls).toBe(0);
    await body.fill("Hola amgo");
    expect(calls).toBe(0);
    await save.focus();
    await expect(hint).toHaveText("Checking your text");
    await expect(save).toBeEnabled();
    release();
    await expect(hint).toHaveText("Possible spelling issue Get feedback to see the fix");
    expect(calls).toBe(1);
    await expect(hint).toBeInViewport();
    await expect(save).toBeInViewport();
    await page.evaluate(() => {
      if (!window.visualViewport) throw new Error("visualViewport unavailable");
      Object.defineProperty(window.visualViewport, "height", { configurable: true, value: 400 });
      window.visualViewport.dispatchEvent(new Event("resize"));
    });
    await expect(page.locator(".writing-form")).toHaveAttribute("data-keyboard-open", "true");
    const hintBox = await hint.boundingBox();
    const bodyBox = await body.boundingBox();
    const saveBox = await save.boundingBox();
    expect(hintBox).not.toBeNull();
    expect(bodyBox).not.toBeNull();
    expect(saveBox).not.toBeNull();
    expect(hintBox!.y).toBeGreaterThanOrEqual(0);
    expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(bodyBox!.y);
    expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(400);
    await page.screenshot({ path: "test-results/jev-spelling-375-keyboard.png" });
    gate = Promise.resolve();
    note = { issue: "uncertain", confidence: 0.4 };
    await body.focus();
    await save.focus();
    await expect(hint).toHaveText("Not sure about this one. Get feedback to check.");
    expect(calls).toBe(2);
    note = null;
    await body.focus();
    await save.focus();
    await expect(hint).toBeEmpty();
    expect(calls).toBe(3);
    await expect(save).toBeEnabled();
  } finally {
    release();
    await sql`delete from journals where id = ${journalId}`;
    await sql.end();
  }
});

test("three corrections show the waiting insight at 375px", async ({ page }) => {
  const journalId = randomUUID();
  const sql = postgres(testDatabaseUrl());
  try {
    await sql`insert into journals (id, language, level) values (${journalId}, 'en', 'basic')`;
    await sql`insert into journal_mistake_counts (journal_id, category, count)
      values (${journalId}, 'grammar', 2), (${journalId}, 'spelling', 1)`;
    await page.goto(`/journals/${journalId}`);
    const card = page.getByLabel("Journal insight", { exact: true });
    await expect(card).toContainText("Mistakes so far in this journal");
    await expect(card).toContainText("Grammar: 2 corrections");
    await expect(card).toContainText("Spelling: 1 correction");
    await expect(card).toContainText("Your insight appears after 5 corrections (3 of 5).");
    await expect(card).not.toContainText("Most of your mistakes");
    await expect(card.getByRole("button", { name: "Summarise this journal" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await sql`delete from journals where id = ${journalId}`;
    await sql.end();
  }
});
test("blur shows a Jev note without an LLM call, saving works, insight displays counts and summarises", async ({
  page,
}) => {
  const journalId = randomUUID();
  const sql = postgres(testDatabaseUrl());
  try {
    await sql`insert into journals (id, language, level) values (${journalId}, 'en', 'basic')`;
    await page.goto(`/journals/${journalId}/entries/new`);
    await page
      .locator("#entry-body")
      .fill("I goes to the market and buy some fresh fruit for dinner.");
    await page.locator("#entry-date").focus();
    await expect(page.locator("#jev-note")).toHaveText(
      "Possible grammar issue Get feedback to see the fix",
    );
    const [jev] = await sql`select count(*)::integer as count from jev_calls`;
    expect(jev.count).toBeGreaterThan(0);
    const [calls] =
      await sql`select count(*)::integer as count from model_calls where journal_id = ${journalId}`;
    expect(calls.count).toBe(0);
    await page.getByRole("button", { name: "Save entry", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/journals/${journalId}/entries/[a-f0-9-]+$`));
    await expect(page.getByRole("status")).toHaveText("Your feedback is ready.");
    await page.getByRole("link", { name: "Back to journal", exact: true }).click();
    const card = page.getByLabel("Journal insight", { exact: true });
    await expect(card).toContainText("Grammar: 1 correction");
    await expect(card).toContainText("Your insight appears after 5 corrections (1 of 5).");
    await expect(card).not.toContainText("Most of your mistakes");
    await card.getByRole("button", { name: "Summarise this journal" }).click();
    await expect(card).toContainText("Practise verb agreement in your next entry.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.reload();
    await expect(card).toContainText("Practise verb agreement in your next entry.");
  } finally {
    await sql`delete from journals where id = ${journalId}`;
    await sql.end();
  }
});

test("slow Jev cannot delay saving", async ({ page }) => {
  const journalId = randomUUID();
  const sql = postgres(testDatabaseUrl());
  try {
    await sql`insert into journals (id, language, level) values (${journalId}, 'en', 'basic')`;
    await page.route("**/api/jev", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await route.fulfill({ json: { issue: "grammar", confidence: 0.99 } });
    });
    await page.goto(`/journals/${journalId}/entries/new`);
    await page
      .locator("#entry-body")
      .fill("Yesterday I goes to the market and buy some fresh fruit for dinner.");
    await page.getByRole("button", { name: "Save entry", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/journals/${journalId}/entries/[a-f0-9-]+$`), {
      timeout: 3000,
    });
  } finally {
    await sql`delete from journals where id = ${journalId}`;
    await sql.end();
  }
});

test("editing hides an old note and ignores an in-flight stale judgement", async ({ page }) => {
  const journalId = randomUUID();
  const sql = postgres(testDatabaseUrl());
  try {
    await sql`insert into journals (id, language, level) values (${journalId}, 'en', 'basic')`;
    await page.goto(`/journals/${journalId}/entries/new`);
    const body = page.locator("#entry-body");
    await body.fill("Yesterday I goes to the market and buy some fresh fruit for dinner.");
    await page.locator("#entry-date").focus();
    await expect(page.locator("#jev-note")).toContainText("Possible grammar issue");
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/jev", async (route) => {
      await gate;
      await route.fulfill({ json: { issue: "grammar", confidence: 0.99 } });
    });
    await body.fill("Today I writes about the market and the fresh fruit I buy.");
    await expect(page.locator("#jev-note")).toBeEmpty();
    const request = page.waitForRequest("**/api/jev");
    await page.locator("#entry-date").focus();
    await request;
    await body.fill("I am still editing this entry and have not requested a new check.");
    const response = page.waitForResponse("**/api/jev");
    release();
    await response;
    await expect(page.locator("#jev-note")).toBeEmpty();
  } finally {
    await sql`delete from journals where id = ${journalId}`;
    await sql.end();
  }
});
