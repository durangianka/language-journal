import { format, parseISO } from "date-fns";
import type { Locale } from "../../config/locales";

// Call in the browser for the learner's device-local calendar day.
export function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatDate(value: string, locale: Locale) {
  // A date-only value is a calendar day, so parse it in the formatting timezone.
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(parseISO(value));
}
