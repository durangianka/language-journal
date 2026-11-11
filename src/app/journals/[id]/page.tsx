import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EntriesList, EntriesListSkeleton } from "@/components/entries-list";
import { JournalDetails, JournalDetailsSkeleton } from "@/components/journal-details";
import { JournalLayout, JournalLink } from "@/components/journal-layout";
import { buttonVariants } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/i18n/server";
import { idSchema } from "@/lib/journal/schemas";

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
      <Suspense
        fallback={
          <span aria-disabled="true" className={buttonVariants({ className: "min-h-11 w-full" })}>
            {t.newEntry}
          </span>
        }
      >
        <NewEntryLink params={params} label={t.newEntry} />
      </Suspense>
      <h2 className="text-xl font-semibold">{t.entries}</h2>
      <Suspense fallback={<EntriesListSkeleton label={t.entries} />}>
        <EntriesList params={params} searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </JournalLayout>
  );
}

async function NewEntryLink({ params, label }: { params: Promise<{ id: string }>; label: string }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  return <JournalLink href={`/journals/${id}/entries/new`}>{label}</JournalLink>;
}
