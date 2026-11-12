import { Lightbulb } from "lucide-react";
import { notFound } from "next/navigation";
import { getJournal, getJournalMistakeCounts } from "@/lib/journal";
import { getTodayInsight } from "@/lib/insight/repository";
import { idSchema } from "@/lib/journal/schemas";
import type { Dictionary, Locale } from "@/i18n/types";
import { JournalSummary } from "./journal-summary";
import { Card, CardContent, CardHeader } from "./ui/card";

export async function JournalInsight({
  params,
  locale,
  t,
}: {
  params: Promise<{ id: string }>;
  locale: Locale;
  t: Dictionary;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [journal, counts, summary] = await Promise.all([
    getJournal(id),
    getJournalMistakeCounts(id),
    getTodayInsight(id, locale),
  ]);
  if (!journal) notFound();
  const top = counts
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
    .slice(0, 3);
  return (
    <Card aria-label={t.journalInsight} className="bg-accent text-accent-foreground shadow-sm">
      <CardHeader>
        <h2 className="flex items-center gap-2 font-semibold">
          <Lightbulb aria-hidden="true" className="size-5" />
          {t.journalInsight}
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {top.length ? (
          <>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {top.map(({ category, count }) => (
                <li key={category}>
                  {t[category]}: {count}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              {t.insightTopCategory.replace("{category}", t[top[0].category])}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t.insightNoMistakes}</p>
        )}
        <JournalSummary journalId={id} initialSummary={summary} t={t} key={locale} />
      </CardContent>
    </Card>
  );
}
