"use client";

import Link from "next/link";
import { CalendarDays, Languages, NotebookPen, Signal } from "lucide-react";
import { DeletedNotice } from "@/components/deleted-notice";
import { FeedbackStatus } from "@/components/feedback-status";
import { languageLabelKeys } from "@/config/domain";
import type { Dictionary, Locale } from "@/i18n/types";
import type { EntryDto } from "@/lib/feedback-contract";
import { formatDate } from "@/lib/journal/dates";
import type { Journal } from "@/lib/journal/types";

export function JournalsOverview({
  journals,
  entries,
  t,
  locale,
  showEntries = true,
}: {
  journals: Journal[];
  entries: EntryDto[];
  t: Dictionary;
  locale: Locale;
  showEntries?: boolean;
}) {
  return (
    <>
      <DeletedNotice t={t} />
      {journals.length === 0 ? (
        <p className="rounded-xl border p-5 text-muted-foreground">{t.emptyJournals}</p>
      ) : (
        <ul className="grid items-start gap-4 sm:grid-cols-2">
          {journals.map((journal) => {
            const journalEntries = entries.filter((entry) => entry.journalId === journal.id);
            const lastEntry = journalEntries.reduce<string | null>(
              (latest, entry) => (!latest || entry.entryDate > latest ? entry.entryDate : latest),
              null,
            );
            return (
              <li key={journal.id} className="min-w-0 rounded-xl border bg-card">
                <Link
                  href={`/journals/${journal.id}`}
                  className="flex min-h-11 flex-col gap-2 rounded-xl p-5 hover:bg-muted focus-visible:outline-2"
                >
                  <span className="flex items-center gap-2 font-heading text-[22px] font-semibold sm:text-[26px]">
                    <Languages aria-hidden="true" className="size-5 shrink-0" />
                    {t[languageLabelKeys[journal.language]]}
                  </span>
                  <span className="flex items-center gap-2 text-sm">
                    <Signal aria-hidden="true" className="size-4 shrink-0" />
                    {t[journal.level]}
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
                    {t.lastEntry}:{" "}
                    {lastEntry ? (
                      <time dateTime={lastEntry}>{formatDate(lastEntry, locale)}</time>
                    ) : (
                      t.noEntriesYet
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <NotebookPen aria-hidden="true" className="size-4 shrink-0" />
                    {t.entries}: {journalEntries.length}
                  </span>
                </Link>
                {showEntries &&
                  journalEntries.map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/journals/${journal.id}/entries/${entry.id}`}
                      className="mx-4 mb-3 flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border p-3 hover:bg-muted focus-visible:outline-2"
                    >
                      <time dateTime={entry.entryDate}>{formatDate(entry.entryDate, locale)}</time>
                      <time dateTime={entry.createdAt} className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(entry.createdAt))}
                      </time>
                      <strong className="line-clamp-1 w-full break-words [overflow-wrap:anywhere]">
                        {entry.body}
                      </strong>
                      <FeedbackStatus feedback={entry.latestFeedback} t={t} />
                    </Link>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
