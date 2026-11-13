// Verified examples from docs/research/shorthand-reference.md.
// These are context clues, not automatic replacements. Ambiguity needs surrounding text.
export const verifiedShorthand = {
  it: {
    x: "per",
    xké: "perché",
    "+": "più",
    "6": "sei",
    cmq: "comunque",
    nn: "non",
    tt: "tutto",
    anke: "anche",
    ke: "che",
    TVB: "ti voglio bene",
    LOL: "laughing out loud (borrowed chat initialism)",
    ASAP: "as soon as possible (borrowed chat initialism)",
    IMHO: "in my humble opinion (borrowed chat initialism)",
  },
  es: {
    xq: "porque / por qué (syntax dependent)",
    pq: "porque / por qué (syntax dependent)",
    tb: "también",
    q: "que",
    x: "por",
    xo: "pero / yo (region and context dependent)",
    xfa: "por favor",
    salu2: "saludos",
    bienv2: "bienvenidos",
  },
  en: {
    ASAP: "as soon as possible",
    IDK: "I don't know",
    LOL: "laughing out loud",
    BTW: "by the way",
    gr8: "great",
    ur: "your / you're (syntax dependent)",
    TBH: "to be honest",
    u: "you",
  },
};

import type { Locale } from "./locales";

// Only verified items from docs/research/shorthand-reference.md.
// These are contextual examples, not a dictionary or an exhaustive allowlist.
export const verifiedShorthandExamples: Record<Locale, string> = {
  it: "x = per; xké = perché; + = più; 6 = sei; cmq = comunque; nn = non; tt = tutto; anke = anche; ke = che; TVB = ti voglio bene; international chat initialisms LOL, ASAP, IMHO.",
  es: "xq / pq = porque or por qué, depending on syntax; tb = también; q = que; x = por; xo = pero or yo, depending on regional context; xfa = por favor; salu2 = saludos; bienv2 = bienvenidos.",
  en: "ASAP, IDK, LOL, BTW; gr8 = great; ur = your or you're, depending on context; u = you; TBH = to be honest.",
};
