export const locales: readonly ["en", "es", "it"] = ["en", "es", "it"];
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
