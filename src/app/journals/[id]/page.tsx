import { Suspense } from "react";
import { EntriesList, EntriesListSkeleton } from "@/components/entries-list";
import { JournalDetails, JournalDetailsSkeleton } from "@/components/journal-details";
import { JournalLayout } from "@/components/journal-layout";
import { JournalInsight } from "@/components/journal-insight";
import { getDictionary, getLocale } from "@/i18n/server";

// Allow initial analysis, one retry and one repair, each with a 20 second timeout.
export const maxDuration = 90;

export default async function JournalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <JournalLayout
      className="max-w-6xl pb-24 sm:pb-10"
      title={t.journals}
      back="/journals"
      backLabel={t.journals}
      heading={
        <Suspense fallback={<JournalDetailsSkeleton title={t.journals} />}>
          <JournalDetails params={params} t={t} />
        </Suspense>
      }
    >
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Suspense fallback={<EntriesListSkeleton label={t.entries} />}>
            <EntriesList params={params} searchParams={searchParams} t={t} locale={locale} />
          </Suspense>
        </div>
        <aside className="min-w-0">
          <Suspense fallback={<p aria-busy="true">{t.journalInsight}</p>}>
            <JournalInsight params={params} t={t} locale={locale} />
          </Suspense>
        </aside>
      </div>
    </JournalLayout>
  );
}
