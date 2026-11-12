import { notFound } from "next/navigation";
import { formatDate } from "@/components/journal-layout";
import { SavedNotice } from "@/components/saved-notice";
import { JournalReview } from "@/components/journal-review";
import type { Dictionary, Locale } from "@/i18n/types";
import { listEntries } from "@/lib/journal";
import { idSchema } from "@/lib/journal/schemas";

export async function EntriesList({
  params,
  searchParams,
  t,
  locale,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
  t: Dictionary;
  locale: Locale;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [entries, query] = await Promise.all([listEntries(id), searchParams]);
  const saved = entries.find((entry) => entry.id === query.saved);

  return (
    <>
      {query.saved !== undefined && (
        <SavedNotice
          date={saved ? formatDate(saved.entryDate, locale) : null}
          label={t.entrySaved}
        />
      )}
      <JournalReview
        id={id}
        initialEntries={entries.map((entry) => ({ ...entry, latestFeedback: null }))}
        locale={locale}
        t={t}
      />
    </>
  );
}

export function EntriesListSkeleton({ label }: { label: string }) {
  return (
    <ul aria-label={label} aria-busy="true" className="flex flex-col gap-3">
      {[0, 1, 2].map((row) => (
        <li key={row} aria-hidden="true" className="min-h-11 rounded-xl border p-5">
          <div className="h-6 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="mt-2 h-5 w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="mt-1 h-5 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </li>
      ))}
    </ul>
  );
}
