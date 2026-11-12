import { z } from "zod";

export const issueSchema = z.enum(["grammar", "vocabulary", "spelling", "style", "none"]);
export type JevNote = { issue: z.infer<typeof issueSchema>; confidence: number };
export const jevQuestions = {
  main_issue: {
    type: "choice",
    instructions: "What is the main language issue in this journal entry?",
    criteria: {
      grammar: "Incorrect grammar, verb tense, agreement or sentence structure.",
      vocabulary: "An incorrect word choice or missing vocabulary.",
      spelling: "Misspelled words or incorrect accents.",
      style: "Unnatural phrasing despite correct grammar and word choice.",
      none: "No major language issues detected.",
    },
  },
  severity: {
    type: "score",
    instructions: "How severe are the language issues in this journal entry?",
    criteria: ["minor", "moderate", "major"],
  },
};

const probability = z.number().min(0).max(1);
export const jevAnswersSchema = z.object({
  main_issue: z.object({
    type: z.literal("choice"),
    choice: issueSchema,
    confidence: probability,
    probabilities: z.record(issueSchema, probability),
  }),
  severity: z.object({
    type: z.literal("score"),
    score: z.number().min(0).max(2),
    confidence: probability,
    legend: z.record(z.string(), z.string()),
    probabilities: z.record(z.string(), probability),
  }),
});
export type JevAnswers = z.infer<typeof jevAnswersSchema>;
