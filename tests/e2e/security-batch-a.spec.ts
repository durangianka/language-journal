import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { testDatabaseUrl } from "../support/test-database-url";

test("both entry gates count ten occupied slots with one entry in trash", async ({ page }) => {
  const sql = postgres(testDatabaseUrl());
  const id = randomUUID();
  try {
    await sql`insert into journals (id, language, level) values (${id}, 'en', 'basic')`;
    await sql`insert into entries (journal_id, body, entry_date, deleted_at)
      select ${id}, 'Entry ' || n, current_date, case when n = 1 then now() end
      from generate_series(1, 10) n`;
    await page.goto(`/journals/${id}`);
    await expect(page.getByRole("link", { name: "New entry", exact: true })).toHaveCount(0);
    await expect(page.locator("main li")).toHaveCount(9);
    await expect(page.getByText("This journal has 10 entries.", { exact: false })).toBeVisible();
    await page.goto(`/journals/${id}/entries/new`);
    await expect(page.getByLabel("Your entry", { exact: true })).toHaveCount(0);
    await expect(page.getByText("This journal has 10 entries.", { exact: false })).toBeVisible();
  } finally {
    await sql`delete from journals where id = ${id}`;
    await sql.end();
  }
});

test("stale trash tab preserves a restored journal and entry, including new writing", async ({
  page,
  context,
}) => {
  const sql = postgres(testDatabaseUrl());
  const journalId = randomUUID();
  const entryJournalId = randomUUID();
  const entryId = randomUUID();
  const stillTrashedId = randomUUID();
  const newId = randomUUID();
  const otherTab = await context.newPage();
  try {
    await sql`insert into journals (id, language, level, deleted_at)
      values (${journalId}, 'es', 'basic', now()), (${entryJournalId}, 'en', 'basic', null)`;
    await sql`insert into entries (id, journal_id, body, entry_date, deleted_at) values
      (${entryId}, ${entryJournalId}, 'Restored entry survives.', current_date, now()),
      (${stillTrashedId}, ${entryJournalId}, 'Delete only this trash.', current_date, now())`;
    await page.goto("/trash");
    await expect(page.getByText("Restored entry survives.", { exact: true })).toBeVisible();
    await otherTab.goto("/trash");
    await otherTab
      .locator("li")
      .filter({ hasText: "Restored entry survives." })
      .getByRole("button", { name: "Restore", exact: true })
      .click();
    await expect(otherTab.getByText("Restored entry survives.", { exact: true })).toHaveCount(0);
    await otherTab
      .locator("li")
      .filter({ hasText: "Spanish" })
      .getByRole("button", { name: "Restore", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await sql`select deleted_at from journals where id = ${journalId}`)[0]?.deleted_at,
      )
      .toBeNull();
    await sql`insert into entries (id, journal_id, body, entry_date) values
      (${newId}, ${journalId}, 'New writing after restoration.', current_date)`;
    await page.getByRole("button", { name: "Empty trash", exact: true }).click();
    await page.getByRole("button", { name: "Confirm permanent deletion", exact: true }).click();
    await expect(page.getByText("Your trash is empty.", { exact: true })).toBeVisible();
    expect(await sql`select id from journals where id = ${journalId}`).toHaveLength(1);
    expect(await sql`select id from entries where id in (${entryId}, ${newId})`).toHaveLength(2);
    expect(await sql`select id from entries where id = ${stillTrashedId}`).toHaveLength(0);
  } finally {
    await otherTab.close();
    await sql`delete from journals where id in (${journalId}, ${entryJournalId})`;
    await sql.end();
  }
});
