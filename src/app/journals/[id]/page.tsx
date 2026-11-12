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
      title={t.journals}
      back="/journals"
      backLabel={t.journals}
      heading={
        <Suspense fallback={<JournalDetailsSkeleton title={t.journals} />}>
          <JournalDetails params={params} t={t} />
        </Suspense>
      }
    >
      <Suspense fallback={<p aria-busy="true">{t.journalInsight}</p>}>
        <JournalInsight params={params} t={t} locale={locale} />
      </Suspense>
      <Suspense fallback={<EntriesListSkeleton label={t.entries} />}>
        <EntriesList params={params} searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </JournalLayout>
  );
}
