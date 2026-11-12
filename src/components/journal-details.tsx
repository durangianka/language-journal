import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { languageLabelKeys } from "@/config/domain";
import type { Dictionary } from "@/i18n/types";
import { getJournal } from "@/lib/journal";
import { idSchema } from "@/lib/journal/schemas";

export async function JournalDetails({
  params,
  t,
}: {
  params: Promise<{ id: string }>;
  t: Dictionary;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const journal = await getJournal(id);
  if (!journal) notFound();

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">
        {t[languageLabelKeys[journal.language]]}
      </h1>
      <Badge variant="secondary">{t[journal.level]}</Badge>
    </>
  );
}

export function JournalDetailsSkeleton({ title }: { title: string }) {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <div
        aria-hidden="true"
        className="h-6 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none"
      />
    </>
  );
}
