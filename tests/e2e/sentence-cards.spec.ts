import "dotenv/config";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { testDatabaseUrl } from "../support/test-database-url";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

test("journal cards appear above the writing box and collapse on a 375px screen", async ({
  page,
}) => {
  await page.goto("/journals/new");
  await page.getByRole("radio", { name: "Italian", exact: true }).check();
  await page.getByRole("radio", { name: "Advanced · C1–C2", exact: true }).check();
  await page.getByRole("button", { name: "Create journal", exact: true }).tap();
  await expect(page).toHaveURL(/\/journals\/[a-f0-9-]+$/);
  const id = new URL(page.url()).pathname.split("/")[2];

  try {
    await page.getByRole("link", { name: "New entry", exact: true }).tap();
    const cards = page.getByRole("region", { name: "Sentence structures", exact: true });
    const toggle = cards.locator("summary");
    const body = page.getByRole("textbox", { name: "Your entry", exact: true });
    await expect(cards.getByRole("listitem")).toHaveCount(4);
    await expect(
      cards.getByRole("heading", { name: "Opinion + subjunctive", exact: true }),
    ).toBeVisible();
    await expect(cards.getByText("penso che + subjunctive", { exact: true })).toBeVisible();
    await expect(cards.getByText("Penso che sia una buona idea.", { exact: true })).toBeVisible();
    await expect(toggle).toHaveText("Show sentence structuresHide sentence structures");
    const cardBox = await cards.boundingBox();
    const bodyBox = await body.boundingBox();
    const toggleBox = await toggle.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(bodyBox).not.toBeNull();
    expect(toggleBox).not.toBeNull();
    expect(cardBox!.y + cardBox!.height).toBeLessThan(bodyBox!.y);
    expect(toggleBox!.height).toBeGreaterThanOrEqual(44);
    expect(toggleBox!.width).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );

    await body.fill("Una giornata tranquilla.");
    await toggle.tap();
    await expect(cards.getByRole("list")).toBeHidden();
    await expect(toggle.getByText("Show sentence structures", { exact: true })).toBeVisible();
    await expect(body).toBeVisible();
    await expect(body).toHaveValue("Una giornata tranquilla.");
    await toggle.tap();
    await expect(cards.getByRole("list")).toBeVisible();
    await expect(toggle.getByText("Hide sentence structures", { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.reload();
    await expect(cards.getByRole("list")).toBeVisible();
  } finally {
    const sql = postgres(testDatabaseUrl());
    try {
      await sql`delete from journals where id = ${id}`;
    } finally {
      await sql.end();
    }
  }
});
