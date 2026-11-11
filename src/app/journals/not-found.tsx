import { JournalLayout } from "@/components/journal-layout";
import { getDictionary } from "@/i18n/server";

export default async function JournalNotFound() {
  const t = await getDictionary();
  return (
    <JournalLayout title={t.journalNotFound} back="/journals" backLabel={t.journals}>
      <p className="text-muted-foreground">{t.invalidJournal}</p>
    </JournalLayout>
  );
}
