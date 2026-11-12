import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { testDatabaseUrl } from "../support/test-database-url";

test.use({ viewport: { width: 375, height: 812 } });

test("typing pause checks while focused and unchanged blur preserves the badge", async ({
  page,
}) => {
  const sql = postgres(testDatabaseUrl());
  const journalId = randomUUID();
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/jev") requests.push(request.postData() ?? "");
  });
  try {
    await sql`insert into journals (id, language, level) values (${journalId}, 'en', 'basic')`;
    await page.goto(`/journals/${journalId}/entries/new`);
    const body = page.locator("#entry-body");
    const note = page.locator("#jev-note");
    const date = page.locator("#entry-date");
    await body.fill("I goes to school every morning and read a book.");
    await expect(body).toBeFocused();
    await expect(note).toBeEmpty();
    expect(requests).toHaveLength(0);
    await expect(note).toContainText("Possible grammar issue");
    await expect(body).toBeFocused();
    expect(requests).toHaveLength(1);
    await date.focus();
    await body.focus();
    await date.focus();
    await expect(note).toContainText("Possible grammar issue");
    expect(requests).toHaveLength(1);
    console.log(
      "375px /api/jev requests: before pause=0, after pause=1, after unchanged blur/refocus=1",
    );
  } finally {
    await sql`delete from journals where id = ${journalId}`;
    await sql.end();
  }
});

test("stale responses are ignored and changed text checks without a further time limit", async ({
  page,
}) => {
  const sql = postgres(testDatabaseUrl());
  const journalId = randomUUID();
  let calls = 0;
  let release = () => {};
  await page.route("**/api/jev", async (route) => {
    calls += 1;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: { issue: "grammar", confidence: 0.9 } });
  });
  try {
    await sql`insert into journals (id, language, level) values (${journalId}, 'en', 'basic')`;
    await page.goto(`/journals/${journalId}/entries/new`);
    const body = page.locator("#entry-body");
    const note = page.locator("#jev-note");
    await body.fill("First sentence to check.");
    await expect(note).toHaveText("Checking your text");
    expect(calls).toBe(1);
    await body.fill("Second sentence to check.");
    await expect(note).toBeEmpty();
    const response = page.waitForResponse("**/api/jev");
    release();
    await response;
    await expect(note).toBeEmpty();
    // The second pause is less than eight seconds after the first call.
    await expect(note).toHaveText("Checking your text");
    expect(calls).toBe(2);
    release();
    await expect(note).toContainText("Possible grammar issue");
    await body.fill("Second sentence to check. Added text.");
    await page.locator("#entry-date").focus();
    await expect(note).toHaveText("Checking your text");
    expect(calls).toBe(3);
    release();
    await expect(note).toContainText("Possible grammar issue");
    await body.fill("Second sentence to check.");
    await page.locator("#entry-date").focus();
    await expect(note).toHaveText("Checking your text");
    expect(calls).toBe(4);
    release();
    await expect(note).toContainText("Possible grammar issue");
  } finally {
    release();
    await sql`delete from journals where id = ${journalId}`;
    await sql.end();
  }
});
