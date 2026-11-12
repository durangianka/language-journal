import type { Locale } from "./locales";

// Only verified items from origin/research/shorthand:out/report.md.
// These are contextual examples, not a dictionary or an exhaustive allowlist.
export const verifiedShorthandExamples: Record<Locale, string> = {
  it: "x = per; xké = perché; + = più; 6 = sei; cmq = comunque; nn = non; tt = tutto; anke = anche; ke = che; TVB = ti voglio bene; international chat initialisms LOL, ASAP, IMHO.",
  es: "xq / pq = porque or por qué, depending on syntax; tb = también; q = que; x = por; xo = pero or yo, depending on regional context; xfa = por favor; salu2 = saludos; bienv2 = bienvenidos.",
  en: "ASAP, IDK, LOL, BTW; gr8 = great; ur = your or you're, depending on context; u = you; TBH = to be honest.",
};
