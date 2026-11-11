import Link from "next/link";
import { JournalLayout, JournalLink, formatDate } from "@/components/journal-layout";
import { languageLabelKeys } from "@/config/domain";
import { getDictionary, getLocale } from "@/i18n/server";
import { listJournals } from "@/lib/journal";

export default async function JournalsPage() {
  const [t, locale, journals] = await Promise.all([getDictionary(), getLocale(), listJournals()]);
  return (
    <JournalLayout title={t.journals} back="/" backLabel={t.home}>
      <JournalLink href="/journals/new">{t.newJournal}</JournalLink>
      {journals.length === 0 ? (
        <p className="rounded-xl border p-5 text-muted-foreground">{t.emptyJournals}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {journals.map((journal) => (
            <li key={journal.id}>
              <Link
                href={`/journals/${journal.id}`}
                className="flex min-h-11 flex-col gap-2 rounded-xl border p-5 hover:bg-muted focus-visible:outline-2"
              >
                <span className="font-semibold">{t[languageLabelKeys[journal.language]]}</span>
                <span className="text-sm">{t[journal.level]}</span>
                <time dateTime={journal.createdAt} className="text-sm text-muted-foreground">
                  {formatDate(journal.createdAt, locale)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </JournalLayout>
  );
}
