import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { dictionaries } from "../../src/i18n/dictionaries";
import { testDatabaseUrl } from "../support/test-database-url";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
test.afterEach(async () => {
  const sql = postgres(testDatabaseUrl());
  try {
    await sql`delete from feedback_settings`;
  } finally {
    await sql.end();
  }
});

for (const locale of ["en", "es", "it"] as const) {
  test(`${locale} mobile settings save and persist through reopening from the header menu`, async ({
    page,
    context,
    baseURL,
  }) => {
    const t = dictionaries[locale];
    await context.addCookies([{ name: "locale", value: locale, url: baseURL! }]);
    await page.goto("/");
    await page.getByRole("button", { name: t.headerMenu, exact: true }).tap();
    await page.getByRole("menuitem", { name: t.settings, exact: true }).tap();
    await expect(page).toHaveURL("/settings");
    await expect(page.getByRole("heading", { name: t.settings, exact: true })).toBeVisible();
    const tone = page.getByRole("group", { name: t.feedbackTone, exact: true });
    const address = page.getByRole("group", { name: t.feedbackAddress, exact: true });
    const gender = page.getByRole("group", { name: t.learnerGender, exact: true });
    await expect(tone.getByRole("button", { name: t.toneFormal, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      address.getByRole("button", { name: t.addressNeutral, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      gender.getByRole("button", { name: t.genderUnspecified, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await tone.getByRole("button", { name: t.toneFriendly, exact: true }).tap();
    await address.getByRole("button", { name: t.addressSis, exact: true }).tap();
    await gender.getByRole("button", { name: t.genderFemale, exact: true }).tap();
    await page.getByRole("button", { name: t.saveFeedbackSettings, exact: true }).tap();
    await expect(page.getByRole("status")).toHaveText(t.feedbackSettingsSaved);
    await page.goto("/");
    await page.getByRole("button", { name: t.headerMenu, exact: true }).tap();
    await page.getByRole("menuitem", { name: t.settings, exact: true }).tap();
    await expect(tone.getByRole("button", { name: t.toneFriendly, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(address.getByRole("button", { name: t.addressSis, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(gender.getByRole("button", { name: t.genderFemale, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.reload();
    await expect(tone.getByRole("button", { name: t.toneFriendly, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const target of await page.locator("a[href]:visible, button:visible").all()) {
      const bounds = await target.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
    }
    await tone.getByRole("button", { name: t.toneSlang, exact: true }).tap();
    await address.getByRole("button", { name: t.addressBro, exact: true }).tap();
    await gender.getByRole("button", { name: t.genderMale, exact: true }).tap();
    await page.getByRole("button", { name: t.saveFeedbackSettings, exact: true }).tap();
    await expect(page.getByRole("status")).toHaveText(t.feedbackSettingsSaved);
    await page.reload();
    await expect(tone.getByRole("button", { name: t.toneSlang, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(address.getByRole("button", { name: t.addressBro, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(gender.getByRole("button", { name: t.genderMale, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
}
