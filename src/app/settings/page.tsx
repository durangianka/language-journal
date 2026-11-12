import { JournalLayout } from "@/components/journal-layout";
import { FeedbackSettingsForm } from "@/components/feedback-settings-form";
import { getDictionary } from "@/i18n/server";
import { getFeedbackSettings } from "@/lib/settings/repository";

export default async function SettingsPage() {
  const [t, settings] = await Promise.all([getDictionary(), getFeedbackSettings()]);
  return (
    <JournalLayout title={t.settings} back="/journals" backLabel={t.journals}>
      <p className="text-sm text-muted-foreground">{t.feedbackSettingsDescription}</p>
      <FeedbackSettingsForm initialSettings={settings} t={t} />
    </JournalLayout>
  );
}
