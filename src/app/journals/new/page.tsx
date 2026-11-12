import { JournalForm } from "@/components/journal-form";
import { JournalLayout } from "@/components/journal-layout";
import { getDictionary } from "@/i18n/server";

export default async function NewJournalPage() {
  const t = await getDictionary();
  return (
    <JournalLayout
      className="max-w-xl"
      title={t.newJournal}
      back="/journals"
      backLabel={t.journals}
    >
      <JournalForm t={t} />
    </JournalLayout>
  );
}
