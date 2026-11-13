import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { testDatabaseUrl } from "../support/test-database-url";

for (const scenario of ["create", "edit", "tenth entry"] as const) {
  const editing = scenario === "edit";
  test(`${scenario}: typing and date changes during save remain unsaved`, async ({ page }) => {
    const sql = postgres(testDatabaseUrl());
    const journalId = randomUUID();
    const entryId = randomUUID();
    let held = false;
    let release!: () => void;
    let intercepted!: () => void;
    const reached = new Promise<void>((resolve) => {
      intercepted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await sql`insert into journals (id, language, level) values (${journalId}, 'en', 'basic')`;
      if (editing)
        await sql`insert into entries (id, journal_id, body, entry_date) values (${entryId}, ${journalId}, 'Earlier writing.', '2026-11-10')`;
      if (scenario === "tenth entry")
        await sql`insert into entries (journal_id, body, entry_date) select ${journalId}, 'Existing writing.', '2026-11-10'::date from generate_series(1, 9)`;
      await page.goto(
        `/journals/${journalId}/entries/${editing ? entryId : "new?date=2026-11-10"}`,
      );
      if (editing) await page.getByRole("button", { name: "Edit", exact: true }).click();
      const body = page.getByRole("textbox", { name: "Your entry", exact: true });
      await body.fill("Submitted writing.");
      await page.route("**/journals/**", async (route) => {
        if (
          held ||
          route.request().method() !== "POST" ||
          !route.request().headers()["next-action"]
        )
          return route.continue();
        // Prefetch GETs must not consume the delayed save interception.
        held = true;
        intercepted();
        await gate;
        await route.continue();
      });
      await page.getByRole("button", { name: "Save entry", exact: true }).click();
      await reached;
      await expect(body).toBeEditable();
      await body.fill("Submitted writing. Added while saving.");
      const date = page.getByRole("button", { name: "Entry date", exact: true });
      await expect(date).toBeEnabled();
      await date.click();
      await page.locator('[data-slot="popover-content"] button[data-day="11/9/2026"]').click();
      release();
      await expect(page.getByRole("button", { name: "Save entry", exact: true })).toBeEnabled();
      await expect(body).toHaveValue("Submitted writing. Added while saving.");
      await expect(page.locator('input[name="entryDate"]')).toHaveValue("2026-11-09");
      await expect(
        page.getByText("Snapshot saved. Your newer changes are still unsaved.", { exact: true }),
      ).toBeVisible();
      const saved =
        await sql`select id, body, entry_date::text from entries where journal_id = ${journalId} and body <> 'Existing writing.'`;
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ body: "Submitted writing.", entry_date: "2026-11-10" });
      let warned = false;
      page.once("dialog", async (dialog) => {
        warned = true;
        await dialog.dismiss();
      });
      await page.getByRole("link", { name: "Back to journal", exact: true }).click();
      expect(warned).toBe(true);
      await expect(body).toHaveValue("Submitted writing. Added while saving.");
      await page.getByRole("button", { name: "Save entry", exact: true }).click();
      await expect(body).toHaveCount(0);
      expect(
        await sql`select id, body, entry_date::text from entries where journal_id = ${journalId} and body <> 'Existing writing.'`,
      ).toEqual([
        {
          id: saved[0].id,
          body: "Submitted writing. Added while saving.",
          entry_date: "2026-11-09",
        },
      ]);
    } finally {
      release();
      await sql`delete from journals where id = ${journalId}`;
      await sql.end();
    }
  });
}

test("live checks disclose sending, default on, and off cancels pauses and ignores in-flight results", async ({
  page,
}) => {
  const sql = postgres(testDatabaseUrl());
  const journalId = randomUUID();
  let calls = 0;
  let release!: () => void;
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
    const toggle = page.getByRole("switch", { name: "Live checks", exact: true });
    const body = page.getByRole("textbox", { name: "Your entry", exact: true });
    await expect(toggle).toBeChecked();
    await expect(
      page.getByText(
        "Pauses and leaving this field send your current text to Jev for live checks.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.clock.install();
    await body.fill("This is a draft with a pending check.");
    await toggle.click();
    await page.clock.fastForward(3000);
    await page.locator("#entry-date").focus();
    expect(calls).toBe(0);
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await body.focus();
    await page.locator("#entry-date").focus();
    await expect.poll(() => calls).toBe(1);
    await toggle.click();
    release();
    await expect(page.locator("#jev-note")).toBeEmpty();
    await body.fill("Another unsaved draft while checks are off.");
    await page.locator("#entry-date").focus();
    await page.clock.fastForward(3000);
    expect(calls).toBe(1);
  } finally {
    release?.();
    await sql`delete from journals where id = ${journalId}`;
    await sql.end();
  }
});

test("failed attempt retains the last successful correction and its analysed original after editing", async ({
  page,
}) => {
  const sql = postgres(testDatabaseUrl());
  const journalId = randomUUID();
  const entryId = randomUUID();
  try {
    await sql`insert into journals (id, language, level) values (${journalId}, 'en', 'basic')`;
    await sql`insert into entries (id, journal_id, body, entry_date) values (${entryId}, ${journalId}, 'My new writing.', '2026-11-10')`;
    await sql`insert into feedback (entry_id, analysed_text, locale, status, corrected_text, corrections, model, prompt_version, created_at)
      values (${entryId}, 'I goes to school.', 'en', 'ready', 'I go to school.', '[]', 'fake', 'test', clock_timestamp() - interval '1 minute')`;
    await sql`insert into feedback (entry_id, analysed_text, locale, status, reason_code, model, prompt_version)
      values (${entryId}, 'My new writing.', 'en', 'failed', 'provider_error', 'fake', 'test')`;
    await page.goto(`/journals/${journalId}/entries/${entryId}`);
    await expect(page.getByRole("status")).toContainText("We could not prepare your feedback.");
    await expect(page.getByText("I go to school.", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Original", exact: true }).click();
    await expect(page.getByText("I goes to school.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("I go to school.", { exact: true })).toBeVisible();
  } finally {
    await sql`delete from journals where id = ${journalId}`;
    await sql.end();
  }
});
