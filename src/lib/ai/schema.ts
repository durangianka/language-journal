import { z } from "zod";
import { eld } from "eld/medium";
import type { Locale } from "../../config/locales";
import { categories } from "../../config/corrections";
import { LIMITS } from "../feedback-contract";

const boundedText = (max: number) => z.string().refine((v) => Array.from(v).length <= max);
export const feedbackOutputSchema = z.strictObject({
  corrected_text: boundedText(LIMITS.entryMaxChars),
  corrections: z
    .array(
      z.strictObject({
        original: z.string().min(1),
        fix: boundedText(LIMITS.entryMaxChars),
        category: z.enum(categories),
        explanation: boundedText(LIMITS.explanationMaxChars).refine(
          (v) => v.trim().length > 0 && !/[\r\n]/.test(v),
        ),
      }),
    )
    .max(LIMITS.correctionsPerFeedback),
});
export type FeedbackOutput = z.infer<typeof feedbackOutputSchema>;

export class InvalidFeedback extends Error {
  constructor(
    public readonly reason: "invalid_json" | "invalid_schema" | "invalid_span" | "wrong_locale",
  ) {
    super(reason);
  }
}

export function validateFeedback(
  text: string,
  analysedText: string,
  locale: Locale,
): FeedbackOutput {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new InvalidFeedback("invalid_json");
  }
  const parsed = feedbackOutputSchema.safeParse(json);
  if (!parsed.success) throw new InvalidFeedback("invalid_schema");
  for (const correction of parsed.data.corrections) {
    // Exact substring, including case, whitespace and accents. Repeated spans are valid.
    if (!analysedText.includes(correction.original)) throw new InvalidFeedback("invalid_span");
    const detected = eld.detect(correction.explanation);
    // Ambiguous or unrecognisable explanations fail closed and enter the repair path.
    if (detected.language !== locale || !detected.isReliable())
      throw new InvalidFeedback("wrong_locale");
  }
  return parsed.data;
}
