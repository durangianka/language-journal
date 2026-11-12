import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { sentenceCards } from "@/config/sentence-cards";
import type { Dictionary, Locale } from "@/i18n/types";
import type { levels } from "@/config/domain";

export function SentenceCards({
  language,
  level,
  t,
}: {
  language: Locale;
  level: (typeof levels)[number];
  t: Dictionary;
}) {
  return (
    <section aria-labelledby="sentence-structures-title" className="min-w-0">
      <h2 id="sentence-structures-title" className="mb-2 text-lg font-semibold">
        {t.sentenceStructures}
      </h2>
      <details open className="group rounded-lg border bg-card text-card-foreground">
        <summary className="min-h-11 min-w-11 cursor-pointer rounded-lg px-4 py-3 text-sm font-medium focus-visible:outline-2">
          <span className="group-open:hidden">{t.showSentenceStructures}</span>
          <span className="hidden group-open:inline">{t.hideSentenceStructures}</span>
        </summary>
        <ScrollArea>
          <ul className="flex w-max snap-x gap-3 px-3 pb-3">
            {sentenceCards[language][level].slice(0, 5).map((card) => (
              <li key={card.titleKey} className="w-64 shrink-0 snap-start wrap-break-word">
                <Card className="h-full gap-2 py-3">
                  <CardHeader className="px-3">
                    <h3 className="text-sm font-semibold">{t[card.titleKey]}</h3>
                  </CardHeader>
                  <CardContent className="px-3">
                    <p
                      lang={language}
                      className="sentence-hint-detail mt-2 font-mono text-sm text-muted-foreground"
                    >
                      {card.template}
                    </p>
                    <p lang={language} className="sentence-hint-detail mt-2 text-sm">
                      {card.example}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </details>
    </section>
  );
}
