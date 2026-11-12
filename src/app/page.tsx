import Link from "next/link";
import { Suspense } from "react";
import { NotebookPen, Plus, Settings, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { JournalsList, JournalsListSkeleton } from "@/components/journals-list";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function Home() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-24 sm:px-6 sm:py-10 lg:pb-10">
      <h1 className="font-semibold tracking-tight">{t.appName}</h1>
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
      <nav
        aria-label={t.headerMenu}
        className="fixed inset-x-0 bottom-0 flex min-h-16 items-center justify-around border-t bg-card px-4 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <Link
          href="/journals"
          className="flex min-h-16 min-w-16 flex-col items-center justify-center gap-1 text-xs font-medium"
        >
          <NotebookPen aria-hidden="true" className="size-5" />
          {t.journals}
        </Link>
        <Link
          href="/settings"
          className="flex min-h-16 min-w-16 flex-col items-center justify-center gap-1 text-xs font-medium"
        >
          <Settings aria-hidden="true" className="size-5" />
          {t.settings}
        </Link>
        <Link
          href="/trash"
          className="flex min-h-16 min-w-16 flex-col items-center justify-center gap-1 text-xs font-medium"
        >
          <Trash2 aria-hidden="true" className="size-5" />
          {t.trash}
        </Link>
      </nav>
    </main>
  );
}
