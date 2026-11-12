import { Suspense } from "react";
import { JournalLayout } from "@/components/journal-layout";
import { TrashList } from "@/components/trash-list";
import { EntriesListSkeleton } from "@/components/entries-list";
import { getDictionary, getLocale } from "@/i18n/server";
import { listTrash } from "@/lib/journal/trash";
import type { Dictionary, Locale } from "@/i18n/types";

async function DeletedItems({ t, locale }: { t: Dictionary; locale: Locale }) {
  return <TrashList items={await listTrash()} t={t} locale={locale} />;
}

export default async function TrashPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <JournalLayout title={t.trash} back="/journals" backLabel={t.journals}>
      <p className="text-muted-foreground">{t.trashDescription}</p>
      <Suspense fallback={<EntriesListSkeleton label={t.trash} />}>
        <DeletedItems t={t} locale={locale} />
      </Suspense>
    </JournalLayout>
  );
}
