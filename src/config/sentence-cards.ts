import type { Locale } from "./locales";
import type { levels } from "./domain";
import type { Dictionary } from "../i18n/types";

export type SentenceCardTitleKey = Extract<keyof Dictionary, `sentenceCard${string}`>;

export type SentenceCard = {
  titleKey: SentenceCardTitleKey;
  template: string;
  example: string;
};

// Templates and examples copied verbatim from the researched sentence-structure report.
export const sentenceCards = {
  it: {
    new: [
      {
        titleKey: "sentenceCardSubjectVerb",
        template: "S + V",
        example: "Io abito a Roma.",
      },
      {
        titleKey: "sentenceCardActionObject",
        template: "(S) + V + O",
        example: "Mangio una mela.",
      },
      {
        titleKey: "sentenceCardState",
        template: "essere + adjective",
        example: "Sono stanca.",
      },
      {
        titleKey: "sentenceCardTimePlace",
        template: "V + time/place",
        example: "Lavoro qui oggi.",
      },
    ],
    basic: [
      {
        titleKey: "sentenceCardPastEvent",
        template: "avere/essere + participle",
        example: "Ho visitato Firenze.",
      },
      {
        titleKey: "sentenceCardHabitInPast",
        template: "imperfect + habit",
        example: "Da bambina giocavo spesso qui.",
      },
      {
        titleKey: "sentenceCardLikeDislike",
        template: "piacere + indirect pronoun + thing",
        example: "Mi piace questo posto.",
      },
      {
        titleKey: "sentenceCardReflexiveRoutine",
        template: "subject + reflexive pronoun + verb",
        example: "Mi sveglio alle sette.",
      },
    ],
    intermediate: [
      {
        titleKey: "sentenceCardObjectPronoun",
        template: "clitic + finite verb",
        example: "La vedo ogni giorno.",
      },
      {
        titleKey: "sentenceCardModalInfinitive",
        template: "modal + infinitive + clitic",
        example: "Voglio comprarlo.",
      },
      {
        titleKey: "sentenceCardRelativeClause",
        template: "noun + che + clause",
        example: "Ho un amico che vive a Torino.",
      },
      {
        titleKey: "sentenceCardPastContrast",
        template: "imperfetto background + passato prossimo event",
        example: "Mentre cenavamo, è arrivato Luca.",
      },
    ],
    advanced: [
      {
        titleKey: "sentenceCardOpinionSubjunctive",
        template: "penso che + subjunctive",
        example: "Penso che sia una buona idea.",
      },
      {
        titleKey: "sentenceCardHypothetical",
        template: "se + subjunctive + conditional",
        example: "Se avessi tempo, partirei.",
      },
      {
        titleKey: "sentenceCardPassive",
        template: "essere + participle",
        example: "Il museo è stato restaurato nel 2020.",
      },
      {
        titleKey: "sentenceCardTopicReprise",
        template: "topic + clitic + comment",
        example: "Il caffè, lo prendo senza zucchero.",
      },
    ],
  },
  es: {
    new: [
      {
        titleKey: "sentenceCardIdentity",
        template: "ser + noun/adjective",
        example: "Soy estudiante.",
      },
      {
        titleKey: "sentenceCardLocationState",
        template: "estar + location/state",
        example: "Madrid está en España.",
      },
      {
        titleKey: "sentenceCardBasicAction",
        template: "S + V + O",
        example: "Ana compra pan.",
      },
      {
        titleKey: "sentenceCardExistence",
        template: "hay + noun",
        example: "Hay una farmacia aquí.",
      },
    ],
    basic: [
      {
        titleKey: "sentenceCardCompletedPast",
        template: "pretérito + event",
        example: "Ayer comí con Ana.",
      },
      {
        titleKey: "sentenceCardOngoingPast",
        template: "imperfecto + background",
        example: "Cuando era niña, vivía cerca.",
      },
      {
        titleKey: "sentenceCardObjectPronoun",
        template: "clitic + conjugated verb",
        example: "Lo veo cada mañana.",
      },
      {
        titleKey: "sentenceCardPreference",
        template: "indirect clitic + gustar + thing",
        example: "Me gustan las novelas.",
      },
    ],
    intermediate: [
      {
        titleKey: "sentenceCardFutureCondition",
        template: "si + present, future",
        example: "Si llueve, nos quedaremos en casa.",
      },
      {
        titleKey: "sentenceCardSubjunctiveWish",
        template: "querer que + subjunctive",
        example: "Espero que tengas tiempo.",
      },
      {
        titleKey: "sentenceCardRelativeClause",
        template: "noun + que + clause",
        example: "Tengo una amiga que trabaja aquí.",
      },
      {
        titleKey: "sentenceCardPronounInfinitive",
        template: "modal + infinitive + clitic",
        example: "Voy a llamarte esta tarde.",
      },
    ],
    advanced: [
      {
        titleKey: "sentenceCardConcession",
        template: "aunque + subjunctive",
        example: "Aunque parezca difícil, podemos hacerlo.",
      },
      {
        titleKey: "sentenceCardImpersonalSe",
        template: "se + 3rd-person verb",
        example: "Aquí se vive muy bien.",
      },
      {
        titleKey: "sentenceCardReportedClaim",
        template: "reporting verb + que + clause",
        example: "La portavoz afirmó que no habría cambios.",
      },
      {
        titleKey: "sentenceCardFocus",
        template: "lo que + clause + ser",
        example: "Lo que necesito es descansar.",
      },
    ],
  },
  en: {
    new: [
      {
        titleKey: "sentenceCardBasicAction",
        template: "S + V + O",
        example: "I like this song.",
      },
      {
        titleKey: "sentenceCardBeDescription",
        template: "S + be + adjective",
        example: "The room is quiet.",
      },
      {
        titleKey: "sentenceCardPresentHabit",
        template: "S + V(s) + time",
        example: "She walks to work.",
      },
      {
        titleKey: "sentenceCardDoQuestion",
        template: "Do/Does + S + base verb?",
        example: "Do you live nearby?",
      },
    ],
    basic: [
      {
        titleKey: "sentenceCardPastEvent",
        template: "S + past verb + time",
        example: "We watched a film last night.",
      },
      {
        titleKey: "sentenceCardFuturePlan",
        template: "S + be going to + verb",
        example: "I'm going to call Maya.",
      },
      {
        titleKey: "sentenceCardObjectPronoun",
        template: "S + verb + object pronoun",
        example: "He invited us.",
      },
      {
        titleKey: "sentenceCardReasonClause",
        template: "clause + because + clause",
        example: "I stayed in because I was tired.",
      },
    ],
    intermediate: [
      {
        titleKey: "sentenceCardPresentPerfect",
        template: "have/has + participle",
        example: "I've just finished my lunch.",
      },
      {
        titleKey: "sentenceCardFirstConditional",
        template: "if + present, will + verb",
        example: "If we leave now, we'll catch the train.",
      },
      {
        titleKey: "sentenceCardPassive",
        template: "be + participle",
        example: "The bridge was built in 1920.",
      },
      {
        titleKey: "sentenceCardRelativeClause",
        template: "noun + who/that + clause",
        example: "I know someone who can help.",
      },
    ],
    advanced: [
      {
        titleKey: "sentenceCardUnrealPast",
        template: "if + past perfect, would have + participle",
        example: "If I'd known, I would have called.",
      },
      {
        titleKey: "sentenceCardInversion",
        template: "negative adverb + auxiliary + subject",
        example: "Rarely have I seen such a view.",
      },
      {
        titleKey: "sentenceCardCleftFocus",
        template: "it is/was + focus + that",
        example: "It was Jo who found the key.",
      },
      {
        titleKey: "sentenceCardReportedStatement",
        template: "reporting verb + that-clause",
        example: "She said that she needed more time.",
      },
    ],
  },
} satisfies Record<Locale, Record<(typeof levels)[number], readonly SentenceCard[]>>;
