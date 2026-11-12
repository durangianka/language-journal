import type { languages, levels } from "../../config/domain";
import type { focusAreas } from "../../config/focus";
import type { Locale } from "../../config/locales";
import type { FeedbackSettings } from "../settings/schema";

export const model = "gpt-6-luna";
export type CallKind = "analysis" | "retry" | "repair";
export type AnalysisInput = {
  analysedText: string;
  language: (typeof languages)[number];
  level: (typeof levels)[number];
  focus: readonly (typeof focusAreas)[number][];
  locale: Locale;
  settings?: FeedbackSettings;
  taskRegister?: "informal" | "formal";
  repair?: { output: string; reason: string };
};
export type ModelResult = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
  validationError?: string;
};
export type GenerateOptions = {
  maxRetries: 0 | 1;
  beforeRetry(): Promise<void>;
};
export interface FeedbackProvider {
  generate(
    input: AnalysisInput,
    signal: AbortSignal,
    options?: GenerateOptions,
  ): Promise<ModelResult>;
}
export class ProviderError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}
