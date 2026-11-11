import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getDictionary } from "@/i18n/server";

export default async function Home() {
  const t = await getDictionary();
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start justify-center gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t.appName}</h1>
      <p className="text-muted-foreground">{t.homeDescription}</p>
      <Link href="/journals/new" prefetch={false} className={buttonVariants({ className: "min-h-11 min-w-11" })}>{t.newJournal}</Link>
    </main>
  );
}
