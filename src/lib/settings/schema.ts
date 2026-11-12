import { z } from "zod";

export const feedbackTones: readonly ["formal", "friendly", "slang"] = [
  "formal",
  "friendly",
  "slang",
];
export const feedbackAddresses: readonly ["neutral", "bro", "sis"] = ["neutral", "bro", "sis"];
export const learnerGenders: readonly ["unspecified", "female", "male"] = [
  "unspecified",
  "female",
  "male",
];

export const feedbackSettingsSchema = z.object({
  tone: z.enum(feedbackTones),
  address: z.enum(feedbackAddresses),
  learnerGender: z.enum(learnerGenders),
});

export type FeedbackSettings = z.infer<typeof feedbackSettingsSchema>;

export const defaultFeedbackSettings: FeedbackSettings = {
  tone: "formal",
  address: "neutral",
  learnerGender: "unspecified",
};

export type SettingsActionState =
  { status: "idle" | "invalid" | "error" } | { status: "saved"; values: FeedbackSettings };
