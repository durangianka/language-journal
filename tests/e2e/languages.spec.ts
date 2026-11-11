import { expect, test } from "@playwright/test";

test("flags switch the interface and persist the locale cookie", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "English", exact: true })).toHaveAttribute("aria-pressed", "true");

  for (const language of [
    { name: "Spanish", locale: "es", heading: "Diario de idiomas", description: "Un espacio para aprender idiomas.", button: "Nuevo diario", active: "Español" },
    { name: "Italiano", locale: "it", heading: "Diario delle lingue", description: "Uno spazio per il tuo percorso di apprendimento delle lingue.", button: "Nuovo diario", active: "Italiano" },
    { name: "Inglese", locale: "en", heading: "Language Journal", description: "A space for your language learning journey.", button: "New journal", active: "English" },
  ]) {
    await page.getByRole("button", { name: language.name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(language.heading);
    await expect(page.getByText(language.description, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: language.button, exact: true })).toHaveAttribute("href", "/journals/new");
    await expect(page.getByRole("button", { name: language.active, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect.poll(async () => (await context.cookies()).find(({ name }) => name === "locale")?.value).toBe(language.locale);
    await expect(page.locator("html")).toHaveAttribute("lang", language.locale);
    await expect(page).toHaveTitle(language.heading);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(language.heading);
  }
});

for (const language of [
  { locale: "en", heading: "Language Journal" },
  { locale: "es", heading: "Diario de idiomas" },
  { locale: "it", heading: "Diario delle lingue" },
]) {
  test(`${language.locale} header fits 375px and has visible keyboard focus`, async ({ page, context }, testInfo) => {
    await context.addCookies([{ name: "locale", value: language.locale, url: "http://127.0.0.1:3100" }]);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(language.heading);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const firstFlag = page.getByRole("button").first();
    await expect(firstFlag).toBeFocused();
    expect(await firstFlag.evaluate((element) => {
      const style = getComputedStyle(element);
      return element.matches(":focus-visible") && (style.boxShadow !== "none" || parseFloat(style.outlineWidth) > 0);
    })).toBe(true);

    const screenshot = testInfo.outputPath(`header-${language.locale}.png`);
    await page.getByRole("banner").screenshot({ path: screenshot });
    await testInfo.attach(`header-${language.locale}`, { path: screenshot, contentType: "image/png" });
  });
}

test("an unsupported locale cookie falls back to English", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "fr", url: "http://127.0.0.1:3100" }]);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Language Journal");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
