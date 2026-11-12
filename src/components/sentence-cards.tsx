"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const [expanded, setExpanded] = useState(false);
  return (
    <section aria-labelledby="sentence-structures-title" className="sentence-hints min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="sentence-structures-title" className="text-base font-semibold">
          {t.sentenceStructures}
        </h2>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 sm:hidden"
          aria-expanded={expanded}
          aria-controls="sentence-hints-list"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? t.seeLess : t.seeMore}
          <ChevronDown aria-hidden="true" />
        </Button>
      </div>
      <ul
        id="sentence-hints-list"
        data-expanded={expanded}
        className="grid min-w-0 gap-2 sm:flex sm:overflow-x-auto sm:pb-2 [&[data-expanded=false]>li:not(:first-child)]:hidden sm:[&[data-expanded=false]>li:not(:first-child)]:block"
      >
        {sentenceCards[language][level].slice(0, 5).map((card) => (
          <li key={card.titleKey} className="min-w-0 wrap-break-word sm:w-56 sm:shrink-0">
            <Card className="h-full gap-2 py-3">
              <CardHeader className="px-3">
                <h3 className="text-sm font-semibold">{t[card.titleKey]}</h3>
              </CardHeader>
              <CardContent className="px-3">
                <p
                  lang={language}
                  className="sentence-hint-detail break-words text-sm text-muted-foreground"
                >
                  {card.template}
                </p>
                <p lang={language} className="sentence-hint-detail mt-1 break-words text-base">
                  {card.example}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
