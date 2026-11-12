"use client";

import { DeleteActions } from "@/components/delete-actions";
import { EntryFeedback } from "@/components/entry-feedback";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
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
      <time dateTime={entry.entryDate}>{date}</time>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">{t.yourEntry}</h2>
        </CardHeader>
        <CardContent>
          <p lang={language} className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
            {entry.body}
          </p>
        </CardContent>
      </Card>
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
