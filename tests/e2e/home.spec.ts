import { expect, test } from "@playwright/test";

test("the home page loads", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Language Journal");
  await expect(page.getByRole("heading", { name: "Language Journal", level: 1 })).toBeVisible();
});
