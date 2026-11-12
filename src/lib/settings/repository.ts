import "server-only";

import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { feedbackSettings } from "../../db/schema";
import { defaultFeedbackSettings, feedbackSettingsSchema, type FeedbackSettings } from "./schema";

// The app currently has one learner. Keep transaction reads on the caller's connection.
export async function getFeedbackSettings(database: Pick<typeof db, "select"> = db) {
  const [settings] = await database
    .select({
      tone: feedbackSettings.tone,
      address: feedbackSettings.address,
      learnerGender: feedbackSettings.learnerGender,
    })
    .from(feedbackSettings)
    .where(eq(feedbackSettings.id, 1));
  return settings ?? { ...defaultFeedbackSettings };
}

export async function saveFeedbackSettings(input: FeedbackSettings) {
  const values = feedbackSettingsSchema.parse(input);
  await db
    .insert(feedbackSettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: feedbackSettings.id, set: values });
  return values;
}
