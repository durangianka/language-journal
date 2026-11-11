import { Suspense } from "react";
import { JournalLayout, JournalLink } from "@/components/journal-layout";
import { JournalsList, JournalsListSkeleton } from "@/components/journals-list";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function JournalsPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <JournalLayout title={t.journals} back="/" backLabel={t.home}>
      <JournalLink href="/journals/new">{t.newJournal}</JournalLink>
      <Suspense fallback={<JournalsListSkeleton label={t.journals} />}>
        <JournalsList t={t} locale={locale} />
      </Suspense>
    </JournalLayout>
  );
}
