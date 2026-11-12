import { Suspense } from "react";
import { JournalLayout } from "@/components/journal-layout";
import { NewEntryBackLink, NewEntryForm, NewEntryFormSkeleton } from "@/components/new-entry-form";
import { getDictionary } from "@/i18n/server";

export default async function NewEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getDictionary();
  return (
    <JournalLayout
      title={t.newEntry}
      back="/journals"
      backLabel={t.backToJournal}
      navigation={
        <Suspense
          fallback={
            <span aria-disabled="true" className="inline-flex min-h-11 items-center text-sm">
              {t.backToJournal}
            </span>
          }
        >
          <NewEntryBackLink params={params} label={t.backToJournal} />
        </Suspense>
      }
    >
      <Suspense fallback={<NewEntryFormSkeleton t={t} />}>
        <NewEntryForm params={params} t={t} />
      </Suspense>
    </JournalLayout>
  );
}
