import { locales, type Locale } from "../config/locales";

export type { Locale } from "../config/locales";

export type Dictionary = {
  appName: string;
  home: string;
  languages: string;
  english: string;
  spanish: string;
  italian: string;
  newJournal: string;
  homeDescription: string;
  journalNotFound: string;
  journals: string;
  emptyJournals: string;
  chooseLanguage: string;
  chooseLevel: string;
  new: string;
  basic: string;
  intermediate: string;
  advanced: string;
  selectLanguageHint: string;
  focus: string;
  focusHint: string;
  focusLimitReached: string;
  travel: string;
  work: string;
  everyday: string;
  grammar: string;
  vocabulary: string;
  food: string;
  createJournal: string;
  saving: string;
  newEntry: string;
  entries: string;
  emptyEntries: string;
  entrySaved: string;
  backToJournal: string;
  entryDate: string;
  yourEntry: string;
  characters: string;
  saveEntry: string;
  invalidLanguage: string;
  invalidLevel: string;
  invalidFocus: string;
  invalidJournal: string;
  invalidBody: string;
  invalidDate: string;
  saveFailed: string;
  enNewHint: string;
  enBasicHint: string;
  enIntermediateHint: string;
  enAdvancedHint: string;
  esNewHint: string;
  esBasicHint: string;
  esIntermediateHint: string;
  esAdvancedHint: string;
  itNewHint: string;
  itBasicHint: string;
  itIntermediateHint: string;
  itAdvancedHint: string;
};

export function isLocale(value: unknown): value is Locale {
  return locales.some((locale) => locale === value);
}
