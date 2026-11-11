import type { levels } from "./domain";

export const focusAreas: readonly ["travel", "work", "everyday", "grammar", "vocabulary", "food"] =
  ["travel", "work", "everyday", "grammar", "vocabulary", "food"];

export const maxFocusByLevel = {
  new: 1,
  basic: 2,
  intermediate: 3,
  advanced: 3,
} satisfies Record<(typeof levels)[number], number>;
