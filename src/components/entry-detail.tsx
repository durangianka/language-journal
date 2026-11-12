"use client";

import { DeleteActions } from "@/components/delete-actions";
import { EntryFeedback } from "@/components/entry-feedback";
import { Badge } from "@/components/ui/badge";
import { languageLabelKeys } from "@/config/domain";
import type { Dictionary, Locale } from "@/i18n/types";
import type { EntryDto } from "@/lib/feedback-contract";
import { formatDate } from "@/lib/journal/dates";

export function EntryDetail({
  initialEntry,
  language,
  locale,
  t,
}: {
  initialEntry: EntryDto;
  language: Locale;
  locale: Locale;
  t: Dictionary;
}) {
  const entry = initialEntry;
  const date = formatDate(entry.entryDate, locale);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <time dateTime={entry.entryDate}>{date}</time>
        <Badge variant="secondary">{t[languageLabelKeys[language]]}</Badge>
      </div>
      <EntryFeedback entry={entry} language={language} locale={locale} t={t} />
      <DeleteActions
        id={entry.id}
        kind="entry"
        date={date}
        returnTo={`/journals/${entry.journalId}`}
        t={t}
      />
    </>
  );
}
