"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { EntryForm } from "@/components/entry-form";
import { Button } from "@/components/ui/button";
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
  const [editing, setEditing] = useState(false);
  const date = formatDate(entry.entryDate, locale);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <time dateTime={entry.entryDate}>{date}</time>
        <Badge variant="secondary">{t[languageLabelKeys[language]]}</Badge>
      </div>
      {editing ? (
        <EntryForm
          key={entry.updatedAt}
          journalId={entry.journalId}
          initialEntry={entry}
          locale={locale}
          t={t}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <Button
            variant="outline"
            className="min-h-11 self-start"
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden="true" />
            {t.editEntry}
          </Button>
          <EntryFeedback
            key={entry.updatedAt}
            entry={entry}
            language={language}
            locale={locale}
            t={t}
          />
        </>
      )}
      <DeleteActions
        id={entry.id}
        kind="entry"
        date={date}
        returnTo={`/journals/${entry.journalId}`}
        t={t}
        onEdit={() => setEditing(true)}
      />
    </>
  );
}
