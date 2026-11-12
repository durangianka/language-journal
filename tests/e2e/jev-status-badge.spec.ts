import { expect, test, type Locator } from "@playwright/test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { dictionaries } from "../../src/i18n/dictionaries";
import { locales } from "../../src/config/locales";
import type { JevNote } from "../../src/lib/jev/contract";
import { testDatabaseUrl } from "../support/test-database-url";

async function aboveTextbox(badge: Locator, body: Locator) {
  const badgeBox = await badge.boundingBox();
  const bodyBox = await body.boundingBox();
  expect(badgeBox).not.toBeNull();
  expect(bodyBox).not.toBeNull();
  expect(badgeBox!.y + badgeBox!.height).toBeLessThanOrEqual(bodyBox!.y);
  expect(badgeBox!.x).toBeGreaterThanOrEqual(bodyBox!.x);
  expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(bodyBox!.x + bodyBox!.width);
}

for (const width of [375, 1280]) {
  for (const locale of locales) {
    test(`Jev badge states and categories in ${locale} at ${width}px`, async ({
      page,
      context,
      baseURL,
    }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: 900 });
      if (!baseURL) throw new Error("Browser base URL missing");
      await context.addCookies([{ name: "locale", value: locale, url: baseURL }]);
      const t = dictionaries[locale];
      const sql = postgres(testDatabaseUrl());
      const journalId = randomUUID();
      let issue: JevNote["issue"] = "none";
      let release: (() => void) | undefined;
      let requests = 0;
      await page.route("**/api/jev", async (route) => {
        requests += 1;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        await route.fulfill({ json: { issue, confidence: 0.9 } });
      });
      try {
        await sql`insert into journals (id, language, level) values (${journalId}, 'en', 'basic')`;
        await page.goto(`/journals/${journalId}/entries/new`);
        const body = page.getByRole("textbox", { name: t.yourEntry, exact: true });
        const date = page.getByRole("button", { name: t.entryDate, exact: true });
        const note = page.locator("#jev-note");
        await expect(note).toBeEmpty();
        await body.fill("Short");
        await date.focus();
        await expect(note).toBeEmpty();
        expect(requests).toBe(0);
        await expect(note).toHaveAttribute("aria-live", "polite");
        await expect(body).toHaveAttribute("aria-describedby", /jev-note/);

        for (const [category, label, colour, icon] of [
          ["none", t.jevNoIssues, "bg-green-100", ".lucide-circle-check"],
          [
            "spelling",
            `${t.jevSpelling} ${t.jevDetails}`,
            "bg-amber-100",
            ".lucide-triangle-alert",
          ],
          ["uncertain", t.jevUncertain, "bg-blue-100", ".lucide-info"],
          ["grammar", `${t.jevGrammar} ${t.jevDetails}`, "bg-amber-100", ".lucide-triangle-alert"],
          [
            "vocabulary",
            `${t.jevVocabulary} ${t.jevDetails}`,
            "bg-amber-100",
            ".lucide-triangle-alert",
          ],
          ["style", `${t.jevStyle} ${t.jevDetails}`, "bg-amber-100", ".lucide-triangle-alert"],
        ] as const) {
          issue = category;
          release = undefined;
          await body.fill(`I am writing a journal entry to check ${category}.`);
          await expect(note).toBeEmpty();
          await date.focus();
          await expect(note).toHaveText(t.jevChecking);
          await expect(note.locator(".animate-spin")).toBeVisible();
          await expect(note.locator("span").first()).toHaveClass(/bg-muted/);
          await aboveTextbox(note, body);
          if (category === "none") {
            await page.screenshot({
              path: `docs/screenshots/jev-status-badge/checking-${locale}-${width}.png`,
              fullPage: true,
              animations: "disabled",
            });
          }
          await expect.poll(() => Boolean(release)).toBe(true);
          release!();
          await expect(note).toHaveText(label);
          await expect(note.locator("span").first()).toHaveClass(new RegExp(colour));
          await expect(note.locator(icon)).toBeVisible();
          await aboveTextbox(note, body);
          const labelBox = await page.locator('label[for="entry-body"]').boundingBox();
          const noteBox = await note.boundingBox();
          expect(labelBox).not.toBeNull();
          expect(noteBox).not.toBeNull();
          if (width === 375 && category === "spelling") {
            expect(noteBox!.y).toBeGreaterThanOrEqual(labelBox!.y + labelBox!.height);
          }
          if (width === 1280 && category === "none") {
            expect(noteBox!.y).toBeLessThan(labelBox!.y + labelBox!.height);
            expect(noteBox!.x).toBeGreaterThan(labelBox!.x + labelBox!.width);
          }
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          if (["none", "spelling", "uncertain"].includes(category)) {
            await page.screenshot({
              path: `docs/screenshots/jev-status-badge/${category}-${locale}-${width}.png`,
              fullPage: true,
            });
          }
        }
        await body.fill("An edit clears the previous badge.");
        await expect(note).toBeEmpty();
      } finally {
        release?.();
        await sql`delete from journals where id = ${journalId}`;
        await sql.end();
      }
    });
  }
}
