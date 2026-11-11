import { z } from "zod";

export const locales: readonly ["en", "es", "it"] = ["en", "es", "it"];
export const localeSchema = z.enum(locales);
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
