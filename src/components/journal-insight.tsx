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
  const total = counts.reduce((sum, { count }) => sum + count, 0);
  const top = counts
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  const leading = top.filter((c) => c.count === top[0]?.count).map((c) => t[c.category]);
  return (
    <Card aria-label={t.journalInsight} className="bg-accent text-accent-foreground shadow-sm">
      <CardHeader>
        <h2 className="flex items-center gap-2 font-semibold">
          <Lightbulb aria-hidden="true" className="size-5" />
          {t.journalInsight}
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <h3 className="font-medium">{t.insightCountsHeading}</h3>
        <p className="text-sm text-muted-foreground">{t.insightCountsScope}</p>
        {top.length ? (
          <>
            <ul className="flex flex-col gap-2">
              {top.map(({ category, count }) => (
                <li key={category}>
                  {t[category]}:{" "}
                  {t[count === 1 ? "insightCorrection" : "insightCorrections"].replace(
                    "{count}",
                    String(count),
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {total >= 5 && top.length
            ? leading.length > 1
              ? t.insightTied.replace("{categories}", leading.join(", "))
              : t.insightTopCategory.replace("{category}", leading[0])
            : t.insightNoMistakes.replace("{count}", String(total))}
        </p>
        <JournalSummary journalId={id} initialSummary={summary} t={t} key={locale} />
      </CardContent>
    </Card>
  );
}
