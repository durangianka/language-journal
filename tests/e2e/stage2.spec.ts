import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { testDatabaseUrl } from "../support/test-database-url";

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
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
    await expect(page.locator("#jev-note")).toHaveText("Grammar. Get feedback gives the detail.");
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
    await expect(card).toContainText("Grammar: 1");
    await expect(card).toContainText("Most of your mistakes this journal are Grammar.");
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
    await expect(page.locator("#jev-note")).toContainText("Grammar");
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
