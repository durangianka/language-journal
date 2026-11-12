"use server";

import { revalidatePath } from "next/cache";
import { saveFeedbackSettings } from "../../lib/settings/repository";
import {
  feedbackSettingsSchema,
  type FeedbackSettings,
  type SettingsActionState,
} from "../../lib/settings/schema";

export async function saveFeedbackSettingsAction(
  _previous: SettingsActionState,
  form: FormData,
): Promise<SettingsActionState> {
  const fields: (keyof FeedbackSettings)[] = ["tone", "address", "learnerGender"];
  if (fields.some((field) => form.getAll(field).length !== 1)) return { status: "invalid" };
  const parsed = feedbackSettingsSchema.safeParse({
    tone: form.get("tone"),
    address: form.get("address"),
    learnerGender: form.get("learnerGender"),
  });
  if (!parsed.success) return { status: "invalid" };
  try {
    const values = await saveFeedbackSettings(parsed.data);
    revalidatePath("/settings");
    return { status: "saved", values };
  } catch {
    return { status: "error" };
  }
}
