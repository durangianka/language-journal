import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EntryDetail } from "@/components/entry-detail";
import { JournalLayout } from "@/components/journal-layout";
import { getDictionary, getLocale } from "@/i18n/server";
import { getEntry, getJournal } from "@/lib/journal";
import { idSchema } from "@/lib/journal/schemas";

export default async function EntryPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense
      fallback={
        <main className="p-4" aria-busy="true">
          {t.yourEntry}
        </main>
      }
    >
      <EntryContent params={params} t={t} locale={locale} />
    </Suspense>
  );
}

async function EntryContent({
  params,
  t,
  locale,
}: {
  params: Promise<{ id: string; entryId: string }>;
  t: Awaited<ReturnType<typeof getDictionary>>;
  locale: Awaited<ReturnType<typeof getLocale>>;
}) {
  const { id, entryId } = await params;
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(entryId).success) notFound();
  const [entry, journal] = await Promise.all([getEntry(entryId), getJournal(id)]);
  if (!entry || !journal || entry.journalId !== id) notFound();
  return (
    <JournalLayout title={t.yourEntry} back={`/journals/${id}`} backLabel={t.backToJournal}>
      <EntryDetail
        initialEntry={{ ...entry, latestFeedback: null }}
        language={journal.language}
        locale={locale}
        t={t}
      />
    </JournalLayout>
  );
}
