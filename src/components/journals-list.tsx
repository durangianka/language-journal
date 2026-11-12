import { JournalsOverview } from "@/components/journals-overview";
import type { Dictionary, Locale } from "@/i18n/types";
import { listEntries, listJournals } from "@/lib/journal";

export async function JournalsList({ t, locale }: { t: Dictionary; locale: Locale }) {
  const journals = await listJournals();
  const groups = await Promise.all(journals.map((journal) => listEntries(journal.id)));
  return <JournalsOverview journals={journals} entries={groups.flat()} t={t} locale={locale} />;
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
