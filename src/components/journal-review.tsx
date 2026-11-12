"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { DeleteActions } from "@/components/delete-actions";
import { DeletedNotice } from "@/components/deleted-notice";
import { FeedbackStatus } from "@/components/feedback-status";
import { JournalLink } from "@/components/journal-layout";
import { useFeedbackStub } from "@/components/use-feedback-stub";
import type { Dictionary, Locale } from "@/i18n/types";
import { visibleEntries } from "@/lib/feedback-client";
import { LIMITS, type EntryDto } from "@/lib/feedback-contract";
import { formatDate } from "@/lib/journal/dates";

function LimitMessage({ t }: { t: Dictionary }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <p>{t.journalEntryLimitReached}</p>
      <JournalLink href="/journals/new">{t.newJournal}</JournalLink>
    </div>
  );
}

export function JournalEntryGate({
  id,
  entries,
  t,
  children,
}: {
  id: string;
  entries: EntryDto[];
  t: Dictionary;
  children: ReactNode;
}) {
  const state = useFeedbackStub();
  if (state.deletedJournals[id]) return <p>{t.invalidJournal}</p>;
  return visibleEntries(entries, state).length >= LIMITS.entriesPerJournal ? (
    <LimitMessage t={t} />
  ) : (
    children
  );
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
  const state = useFeedbackStub();
  const entries = visibleEntries(initialEntries, state);
  if (state.deletedJournals[id])
    return (
      <>
        <p>{t.invalidJournal}</p>
        <JournalLink href="/journals">{t.journals}</JournalLink>
      </>
    );
  return (
    <>
      <DeletedNotice t={t} />
      {entries.length >= LIMITS.entriesPerJournal ? (
        <LimitMessage t={t} />
      ) : (
        <JournalLink href={`/journals/${id}/entries/new`}>{t.newEntry}</JournalLink>
      )}
      <h2 className="text-xl font-semibold">{t.entries}</h2>
      {entries.length === 0 ? (
        <p className="rounded-xl border p-5 text-muted-foreground">{t.emptyEntries}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link
                href={`/journals/${id}/entries/${entry.id}`}
                className="flex min-h-11 flex-col gap-2 rounded-xl border p-5 hover:bg-muted focus-visible:outline-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <time dateTime={entry.entryDate} className="font-semibold">
                    {formatDate(entry.entryDate, locale)}
                  </time>
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
