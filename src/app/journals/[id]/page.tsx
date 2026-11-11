import { notFound } from "next/navigation";
import { JournalLayout, JournalLink, formatDate } from "@/components/journal-layout";
import { SavedNotice } from "@/components/saved-notice";
import { languageLabelKeys } from "@/config/domain";
import { getDictionary, getLocale } from "@/i18n/server";
import { getJournal, listEntries } from "@/lib/journal";
import { idSchema } from "@/lib/journal/schemas";

export default async function JournalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [journal, entries, t, locale, query] = await Promise.all([
    getJournal(id),
    listEntries(id),
    getDictionary(),
    getLocale(),
    searchParams,
  ]);
  if (!journal) notFound();
  const saved = entries.find((entry) => entry.id === query.saved);
  return (
    <JournalLayout
      title={t[languageLabelKeys[journal.language]]}
      back="/journals"
      backLabel={t.journals}
    >
      <p className="text-muted-foreground">{t[journal.level]}</p>
      {query.saved !== undefined && (
        <SavedNotice
          date={saved ? formatDate(saved.entryDate, locale) : null}
          label={t.entrySaved}
        />
      )}
      <JournalLink href={`/journals/${id}/entries/new`}>{t.newEntry}</JournalLink>
      <h2 className="text-xl font-semibold">{t.entries}</h2>
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
    </JournalLayout>
  );
}
