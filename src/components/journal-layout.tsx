import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
export { formatDate } from "@/lib/journal/dates";

export function JournalLayout({
  title,
  children,
  back,
  backLabel,
  heading,
}: {
  title: string;
  children: ReactNode;
  back: string;
  backLabel: string;
  heading?: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <Link
        href={back}
        className="inline-flex min-h-11 min-w-11 items-center self-start rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2"
      >
        {backLabel}
      </Link>
      {heading ?? <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>}
      {children}
    </main>
  );
}

export function JournalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonVariants({ className: "min-h-11 w-full" })}>
      {children}
    </Link>
  );
}
