"use client";

import Link from "next/link";
import { DeletedNotice } from "@/components/deleted-notice";
import { FeedbackStatus } from "@/components/feedback-status";
import { useFeedbackStub } from "@/components/use-feedback-stub";
import { languageLabelKeys } from "@/config/domain";
import type { Dictionary, Locale } from "@/i18n/types";
import { visibleEntries } from "@/lib/feedback-client";
import type { EntryDto } from "@/lib/feedback-contract";
import { formatDate } from "@/lib/journal/dates";
import type { Journal } from "@/lib/journal/types";

export function JournalsOverview({
  journals,
  entries,
  t,
  locale,
}: {
  journals: Journal[];
  entries: EntryDto[];
  t: Dictionary;
  locale: Locale;
}) {
  const state = useFeedbackStub();
  const active = journals.filter((journal) => !state.deletedJournals[journal.id]);
  const visible = visibleEntries(entries, state);
  return (
    <>
      <DeletedNotice t={t} />
      {active.length === 0 ? (
        <p className="rounded-xl border p-5 text-muted-foreground">{t.emptyJournals}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map((journal) => (
            <li key={journal.id} className="rounded-xl border">
              <Link
                href={`/journals/${journal.id}`}
                className="flex min-h-11 flex-col gap-2 rounded-xl p-5 hover:bg-muted focus-visible:outline-2"
              >
                <span className="font-semibold">{t[languageLabelKeys[journal.language]]}</span>
                <span className="text-sm">{t[journal.level]}</span>
                <time dateTime={journal.createdAt} className="text-sm text-muted-foreground">
                  {formatDate(journal.createdAt, locale)}
                </time>
              </Link>
              {visible
                .filter((entry) => entry.journalId === journal.id)
                .map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/journals/${journal.id}/entries/${entry.id}`}
                    className="mx-4 mb-3 flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border p-3 hover:bg-muted focus-visible:outline-2"
                  >
                    <time dateTime={entry.entryDate}>{formatDate(entry.entryDate, locale)}</time>
                    <FeedbackStatus feedback={entry.latestFeedback} t={t} />
                  </Link>
                ))}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
