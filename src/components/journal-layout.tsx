import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
export { formatDate } from "@/lib/journal/dates";

export function JournalLayout({
  title,
  children,
  back,
  backLabel,
  heading,
  navigation,
  className,
}: {
  title: string;
  children: ReactNode;
  back: string;
  backLabel: string;
  heading?: ReactNode;
  navigation?: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10",
        className,
      )}
    >
      {navigation ?? (
        <Link
          href={back}
          className="inline-flex min-h-11 min-w-11 items-center self-start rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2"
        >
          {backLabel}
        </Link>
      )}
      {heading ?? <h1 className="font-semibold tracking-tight">{title}</h1>}
      {children}
    </main>
  );
}

export function JournalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonVariants({ className: cn("min-h-11 w-full", className) })}>
      {children}
    </Link>
  );
}
