import { expect, test } from "vitest";
import { dictionaries } from "../../src/i18n/dictionaries";
import { isLocale, locales } from "../../src/i18n/types";

test.each(locales)("%s has the complete dictionary and nonempty translations", (locale) => {
  expect(Object.keys(dictionaries[locale]).sort()).toEqual(Object.keys(dictionaries.en).sort());
  for (const value of Object.values(dictionaries[locale])) {
    expect(value.trim().length).toBeGreaterThan(0);
  }
});

test("only the three supported locales are accepted", () => {
  for (const locale of locales) expect(isLocale(locale)).toBe(true);
  for (const value of [undefined, null, "", "fr", "EN", "toString", "__proto__"]) {
    expect(isLocale(value)).toBe(false);
  }
});
