import Link from "next/link";
import { formatDate } from "@/components/journal-layout";
import { languageLabelKeys } from "@/config/domain";
import type { Dictionary, Locale } from "@/i18n/types";
import { listJournals } from "@/lib/journal";

export async function JournalsList({ t, locale }: { t: Dictionary; locale: Locale }) {
  const journals = await listJournals();

  return journals.length === 0 ? (
    <p className="rounded-xl border p-5 text-muted-foreground">{t.emptyJournals}</p>
  ) : (
    <ul className="flex flex-col gap-3">
      {journals.map((journal) => (
        <li key={journal.id}>
          <Link
            href={`/journals/${journal.id}`}
            className="flex min-h-11 flex-col gap-2 rounded-xl border p-5 hover:bg-muted focus-visible:outline-2"
          >
            <span className="font-semibold">{t[languageLabelKeys[journal.language]]}</span>
            <span className="text-sm">{t[journal.level]}</span>
            <time dateTime={journal.createdAt} className="text-sm text-muted-foreground">
              {formatDate(journal.createdAt, locale)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function JournalsListSkeleton({ label }: { label: string }) {
  return (
    <ul aria-label={label} aria-busy="true" className="flex flex-col gap-3">
      {[0, 1, 2].map((row) => (
        <li
          key={row}
          aria-hidden="true"
          className="flex min-h-11 flex-col gap-2 rounded-xl border p-5"
        >
          <div className="h-6 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-5 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-5 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </li>
      ))}
    </ul>
  );
}
