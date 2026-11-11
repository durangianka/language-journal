import { locales } from "./locales";

export const languages = locales;

export const languageLabelKeys = {
  en: "english",
  es: "spanish",
  it: "italian",
} satisfies Record<(typeof languages)[number], "english" | "spanish" | "italian">;

export const focusAreas: readonly ["travel", "work", "everyday", "grammar", "vocabulary"] = [
  "travel",
  "work",
  "everyday",
  "grammar",
  "vocabulary",
];

export const levels: readonly ["new", "basic", "intermediate", "advanced"] = [
  "new",
  "basic",
  "intermediate",
  "advanced",
];

export const levelHintKeys: {
  [Language in (typeof languages)[number]]: {
    [Level in (typeof levels)[number]]: `${Language}${Capitalize<Level>}Hint`;
  };
} = {
  en: {
    new: "enNewHint",
    basic: "enBasicHint",
    intermediate: "enIntermediateHint",
    advanced: "enAdvancedHint",
  },
  es: {
    new: "esNewHint",
    basic: "esBasicHint",
    intermediate: "esIntermediateHint",
    advanced: "esAdvancedHint",
  },
  it: {
    new: "itNewHint",
    basic: "itBasicHint",
    intermediate: "itIntermediateHint",
    advanced: "itAdvancedHint",
  },
};
