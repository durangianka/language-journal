import { Suspense } from "react";
import { JournalLayout } from "@/components/journal-layout";
import { FeedbackSettingsForm } from "@/components/feedback-settings-form";
import { getDictionary } from "@/i18n/server";
import { getFeedbackSettings } from "@/lib/settings/repository";
import type { Dictionary } from "@/i18n/types";

async function SavedSettings({ t }: { t: Dictionary }) {
  const settings = await getFeedbackSettings();
  return <FeedbackSettingsForm initialSettings={settings} t={t} />;
}

export default async function SettingsPage() {
  const t = await getDictionary();
  return (
    <JournalLayout title={t.settings} back="/journals" backLabel={t.journals}>
      <p className="text-sm text-muted-foreground">{t.feedbackSettingsDescription}</p>
      <Suspense fallback={<p role="status">{t.loadingFeedbackSettings}</p>}>
        <SavedSettings t={t} />
      </Suspense>
    </JournalLayout>
  );
}
