import { notFound } from "next/navigation";
import Link from "next/link";
import { EntryForm } from "@/components/entry-form";
import { JournalEntryGate } from "@/components/journal-review";
import { SentenceCards } from "@/components/sentence-cards";
import type { Dictionary } from "@/i18n/types";
import { countOccupiedEntrySlots, getJournal } from "@/lib/journal";
import { idSchema } from "@/lib/journal/schemas";
import { getLocale } from "@/i18n/server";

export async function NewEntryForm({
  params,
  t,
}: {
  params: Promise<{ id: string }>;
  t: Dictionary;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [journal, occupiedSlots, locale] = await Promise.all([
    getJournal(id),
    countOccupiedEntrySlots(id),
    getLocale(),
  ]);
  if (!journal) notFound();

  return (
    <JournalEntryGate occupiedSlots={occupiedSlots} t={t}>
      <div className="writing-workspace flex min-w-0 flex-col gap-4">
        <SentenceCards language={journal.language} level={journal.level} t={t} />
        <EntryForm journalId={id} t={t} locale={locale} />
      </div>
    </JournalEntryGate>
  );
}

export async function NewEntryBackLink({
  params,
  label,
}: {
  params: Promise<{ id: string }>;
  label: string;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  return (
    <Link
      href={`/journals/${id}`}
      className="inline-flex min-h-11 min-w-11 items-center self-start rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2"
    >
      {label}
    </Link>
  );
}

export function NewEntryFormSkeleton({ t }: { t: Dictionary }) {
  return (
    <div aria-label={t.newEntry} aria-busy="true" className="flex flex-col gap-5">
      <span className="flex min-h-11 items-center font-semibold">{t.entryDate}</span>
      <div
        aria-hidden="true"
        className="h-11 w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
      />
      <span className="flex min-h-11 items-center font-semibold">{t.yourEntry}</span>
      <div
        aria-hidden="true"
        className="h-64 w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
      />
      <p className="text-right text-sm text-muted-foreground">0 / 2000 {t.characters}</p>
      <div
        aria-hidden="true"
        className="h-11 w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
      />
    </div>
  );
}
