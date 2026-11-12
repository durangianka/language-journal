import { JournalsOverview } from "@/components/journals-overview";
import { JournalCalendar } from "@/components/journal-calendar";
import { JournalInsight } from "@/components/journal-insight";
import { languageLabelKeys } from "@/config/domain";
import type { Dictionary, Locale } from "@/i18n/types";
import { listEntries, listJournals } from "@/lib/journal";

export async function JournalsList({
  t,
  locale,
  showEntries = true,
}: {
  t: Dictionary;
  locale: Locale;
  showEntries?: boolean;
}) {
  const journals = await listJournals();
  const groups = await Promise.all(journals.map((journal) => listEntries(journal.id)));
  const overview = (
    <JournalsOverview
      journals={journals}
      entries={groups.flat()}
      t={t}
      locale={locale}
      showEntries={showEntries}
    />
  );
  const first = journals[0];
  if (showEntries || !first) return overview;
  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col gap-4">
        <p className="text-sm font-medium text-muted-foreground">
          {t[languageLabelKeys[first.language]]}
        </p>
        <JournalCalendar
          dates={groups[0].map((entry) => entry.entryDate)}
          journalId={first.id}
          locale={locale}
          t={t}
          overview
        />
        <JournalInsight params={Promise.resolve({ id: first.id })} locale={locale} t={t} />
      </aside>
      {overview}
    </div>
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
