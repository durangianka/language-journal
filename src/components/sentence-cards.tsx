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
        <ul className="grid min-w-0 gap-3 px-3 pb-3 sm:grid-cols-2">
          {sentenceCards[language][level].slice(0, 5).map((card) => (
            <li key={card.titleKey} className="min-w-0 rounded-md border p-3 wrap-break-word">
              <h3 className="text-sm font-semibold">{t[card.titleKey]}</h3>
              <p lang={language} className="mt-2 font-mono text-sm text-muted-foreground">
                {card.template}
              </p>
              <p lang={language} className="mt-2 text-sm">
                {card.example}
              </p>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
