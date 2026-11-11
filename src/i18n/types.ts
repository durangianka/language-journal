export const locales = ["en", "es", "it"] as const;
export type Locale = (typeof locales)[number];

export type Dictionary = {
  appName: string;
  home: string;
  languages: string;
  english: string;
  spanish: string;
  italian: string;
  newJournal: string;
  homeDescription: string;
};

export function isLocale(value: unknown): value is Locale {
  return locales.some((locale) => locale === value);
}
