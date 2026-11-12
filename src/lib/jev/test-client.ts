import "server-only";
import type { JevClient } from "./service";

export const testJevClient: JevClient = {
  async judge() {
    return {
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
