"use client";

import Link from "next/link";
import { Plus, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { DeleteActions } from "@/components/delete-actions";
import { DeletedNotice } from "@/components/deleted-notice";
import { FeedbackStatus } from "@/components/feedback-status";
import { JournalLink } from "@/components/journal-layout";
import { JournalCalendar } from "@/components/journal-calendar";
import type { Dictionary, Locale } from "@/i18n/types";
import { LIMITS, type EntryDto } from "@/lib/feedback-contract";
import { formatDate } from "@/lib/journal/dates";

function LimitMessage({ t }: { t: Dictionary }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <p>{t.journalEntryLimitReached}</p>
      <JournalLink href="/journals/new">
        <Plus aria-hidden="true" />
        {t.newJournal}
      </JournalLink>
    </div>
  );
}

export function JournalEntryGate({
  entries,
  t,
  children,
}: {
  entries: EntryDto[];
  t: Dictionary;
  children: ReactNode;
}) {
  return entries.length >= LIMITS.entriesPerJournal ? <LimitMessage t={t} /> : children;
}

export function JournalReview({
  id,
  initialEntries,
  locale,
  t,
}: {
  id: string;
  initialEntries: EntryDto[];
  locale: Locale;
  t: Dictionary;
}) {
  const entries = initialEntries;
  return (
    <>
      <DeletedNotice t={t} />
      {entries.length >= LIMITS.entriesPerJournal ? (
        <LimitMessage t={t} />
      ) : (
        <JournalLink href={`/journals/${id}/entries/new`}>
          <PenLine aria-hidden="true" />
          {t.newEntry}
        </JournalLink>
      )}
      <JournalCalendar
        dates={entries.map((entry) => entry.entryDate)}
        journalId={id}
        locale={locale}
        t={t}
      />
      <h2 className="text-xl font-semibold">{t.entries}</h2>
      {entries.length === 0 ? (
        <p className="rounded-xl border p-5 text-muted-foreground">{t.emptyEntries}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              id={
                index === 0 || entries[index - 1].entryDate !== entry.entryDate
                  ? `entries-${entry.entryDate}`
                  : undefined
              }
              className="scroll-mt-4"
            >
              {(index === 0 || entries[index - 1].entryDate !== entry.entryDate) && (
                <h3 className="mb-2 mt-3 font-semibold">
                  <time dateTime={entry.entryDate}>{formatDate(entry.entryDate, locale)}</time>
                </h3>
              )}
              <Link
                href={`/journals/${id}/entries/${entry.id}`}
                className="flex min-h-11 flex-col gap-2 rounded-xl border p-5 hover:bg-muted focus-visible:outline-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <FeedbackStatus feedback={entry.latestFeedback} t={t} />
                </div>
                <p className="line-clamp-2 break-words whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {Array.from(entry.body).slice(0, 160).join("")}
                  {Array.from(entry.body).length > 160 ? "…" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <DeleteActions id={id} kind="journal" returnTo="/journals" t={t} />
    </>
  );
}
