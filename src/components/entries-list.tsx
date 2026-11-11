import { notFound } from "next/navigation";
import { formatDate } from "@/components/journal-layout";
import { SavedNotice } from "@/components/saved-notice";
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
      {entries.length === 0 ? (
        <p className="rounded-xl border p-5 text-muted-foreground">{t.emptyEntries}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id} className="min-h-11 rounded-xl border p-5">
              <time dateTime={entry.entryDate} className="font-semibold">
                {formatDate(entry.entryDate, locale)}
              </time>
              <p className="mt-2 line-clamp-2 break-words whitespace-pre-wrap text-sm text-muted-foreground">
                {Array.from(entry.body).slice(0, 160).join("")}
                {Array.from(entry.body).length > 160 ? "…" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
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
