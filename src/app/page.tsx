import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { JournalsList, JournalsListSkeleton } from "@/components/journals-list";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function Home() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t.appName}</h1>
      <Link
        href="/journals/new"
        prefetch={false}
        className={buttonVariants({ className: "min-h-11 min-w-11 self-start" })}
      >
        <Plus aria-hidden="true" />
        {t.newJournal}
      </Link>
      <section aria-label={t.journals}>
        <Suspense fallback={<JournalsListSkeleton label={t.journals} />}>
          <JournalsList t={t} locale={locale} showEntries={false} />
        </Suspense>
      </section>
    </main>
  );
}
