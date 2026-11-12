"use client";

import { useActionState, useState } from "react";
import { saveFeedbackSettingsAction } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldSet, FieldLegend, FieldDescription } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Dictionary } from "@/i18n/types";
import {
  feedbackTones,
  feedbackAddresses,
  learnerGenders,
  type FeedbackSettings,
  type SettingsActionState,
} from "@/lib/settings/schema";

type SettingsGroup = {
  [Name in keyof FeedbackSettings]: {
    name: Name;
    label: keyof Dictionary;
    hint: keyof Dictionary;
    options: readonly FeedbackSettings[Name][];
  };
}[keyof FeedbackSettings];

const groups: readonly SettingsGroup[] = [
  { name: "tone", label: "feedbackTone", hint: "feedbackToneHint", options: feedbackTones },
  {
    name: "address",
    label: "feedbackAddress",
    hint: "feedbackAddressHint",
    options: feedbackAddresses,
  },
  {
    name: "learnerGender",
    label: "learnerGender",
    hint: "learnerGenderHint",
    options: learnerGenders,
  },
];

const optionLabels = {
  formal: "toneFormal",
  friendly: "toneFriendly",
  slang: "toneSlang",
  neutral: "addressNeutral",
  bro: "addressBro",
  sis: "addressSis",
  unspecified: "genderUnspecified",
  female: "genderFemale",
  male: "genderMale",
} satisfies Record<FeedbackSettings[keyof FeedbackSettings], keyof Dictionary>;

export function FeedbackSettingsForm({
  initialSettings,
  t,
}: {
  initialSettings: FeedbackSettings;
  t: Dictionary;
}) {
  const [values, setValues] = useState(initialSettings);
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(
    saveFeedbackSettingsAction,
    { status: "idle" },
  );
  const saved =
    state.status === "saved" && groups.every(({ name }) => values[name] === state.values[name]);

  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      className="flex flex-col gap-6"
    >
      <FieldGroup>
        {groups.map(({ name, label, hint, options }) => (
          <FieldSet key={name} disabled={pending} aria-describedby={`${name}-hint`}>
            <FieldLegend>{t[label]}</FieldLegend>
            <FieldDescription id={`${name}-hint`}>{t[hint]}</FieldDescription>
            <input type="hidden" name={name} value={values[name]} />
            <ToggleGroup
              aria-label={t[label]}
              aria-describedby={`${name}-hint`}
              aria-invalid={state.status === "invalid"}
              value={[values[name]]}
              variant="outline"
              spacing={0}
              className="w-full"
              disabled={pending}
              onValueChange={(next) => {
                const value = options.find((option) => option === next[0]);
                if (value) setValues((current) => ({ ...current, [name]: value }));
              }}
            >
              {options.map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="min-h-12 min-w-11 flex-1 px-2"
                >
                  {t[optionLabels[value]]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>
        ))}
      </FieldGroup>
      {state.status === "invalid" || state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.status === "invalid" ? t.invalidFeedbackSettings : t.saveFailed}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="text-sm">
        {saved ? t.feedbackSettingsSaved : null}
      </p>
      <Button type="submit" disabled={pending} className="min-h-11 w-full">
        {pending ? t.saving : t.saveFeedbackSettings}
      </Button>
    </form>
  );
}
