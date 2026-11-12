import { z } from "zod";
import { LOCALES } from "../lib/feedback-contract";

export const locales = LOCALES;
export const localeSchema = z.enum(locales);
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
