import { notFound } from "next/navigation";
import { EntryForm } from "@/components/entry-form";
import { JournalLayout } from "@/components/journal-layout";
import { getDictionary } from "@/i18n/server";
import { getJournal } from "@/lib/journal";
import { idSchema } from "@/lib/journal/schemas";

export default async function NewEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [journal, t] = await Promise.all([getJournal(id), getDictionary()]);
  if (!journal) notFound();
  return (
    <JournalLayout title={t.newEntry} back={`/journals/${id}`} backLabel={t.backToJournal}>
      <EntryForm journalId={id} t={t} />
    </JournalLayout>
  );
}
