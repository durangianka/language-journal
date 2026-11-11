import { en } from "./en";
import { es } from "./es";
import { it } from "./it";
import type { Dictionary, Locale } from "../types";

export const dictionaries = { en, es, it } satisfies Record<Locale, Dictionary>;
