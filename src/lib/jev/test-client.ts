import "server-only";
import type { JevClient } from "./service";

export const testJevClient: JevClient = {
  async judge() {
    return {
      text_kind: {
        type: "choice",
        choice: "standard_language",
        confidence: 1,
        probabilities: {
          standard_language: 1,
          informal_language: 0,
          mixed: 0,
          formula_or_numbers: 0,
          encoded: 0,
          random: 0,
          other_language: 0,
        },
      },
      main_issue: {
        type: "choice",
        choice: "grammar",
        confidence: 0.96,
        probabilities: { grammar: 0.96, vocabulary: 0.01, spelling: 0.01, style: 0.01, none: 0.01 },
      },
      severity: {
        type: "score",
        score: 1,
        confidence: 1,
        legend: { "0": "minor", "1": "moderate", "2": "major" },
        probabilities: { "0": 0, "1": 1, "2": 0 },
      },
    };
  },
};
