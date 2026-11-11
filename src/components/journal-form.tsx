"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createJournalAction } from "@/app/journals/actions";
import { FieldError } from "@/components/field-error";
import { UnitedKingdomFlag } from "@/components/flags/united-kingdom";
import { SpainFlag } from "@/components/flags/spain";
import { ItalyFlag } from "@/components/flags/italy";
import { Button } from "@/components/ui/button";
import { focusAreas, languages, languageLabelKeys, levels, levelHintKeys } from "@/config/domain";
import type { Locale } from "@/config/locales";
import type { Dictionary } from "@/i18n/types";
import type { ActionResult } from "@/lib/journal/action-input";

const flags = { en: UnitedKingdomFlag, es: SpainFlag, it: ItalyFlag };
const choiceClass =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-4 has-checked:border-primary has-checked:bg-muted focus-within:outline-2 focus-within:outline-offset-2";

export function JournalForm({ t }: { t: Dictionary }) {
  const router = useRouter();
  const [language, setLanguage] = useState<Locale | null>(null);
  const [focus, setFocus] = useState<string[]>([]);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_previous, form) => {
      const result = await createJournalAction(form);
      if (result.success) router.push(`/journals/${result.id}`);
      return result;
    },
    null,
  );
  const errors = state && !state.success ? state.errors : {};

  return (
    <form action={action} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-3" aria-describedby="language-error">
        <legend className="mb-3 font-semibold">{t.chooseLanguage}</legend>
        {languages.map((value) => {
          const Flag = flags[value];
          const label = t[languageLabelKeys[value]];
          return (
            <label key={value} className={choiceClass}>
              <input
                className="size-11 shrink-0 accent-primary"
                type="radio"
                name="language"
                value={value}
                required
                aria-label={label}
                checked={language === value}
                onChange={() => setLanguage(value)}
              />
              <span aria-hidden="true">
                <Flag title={label} />
              </span>
              <span>{label}</span>
            </label>
          );
        })}
        <FieldError id="language-error" error={errors.language} t={t} />
      </fieldset>
      <fieldset className="flex flex-col gap-3" aria-describedby="level-error">
        <legend className="mb-3 font-semibold">{t.chooseLevel}</legend>
        {levels.map((level) => (
          <label key={level} className={choiceClass}>
            <input
              className="size-11 shrink-0 accent-primary"
              type="radio"
              name="level"
              value={level}
              required
              aria-label={t[level]}
            />
            <span className="flex flex-col gap-1">
              <span className="font-medium">{t[level]}</span>
              <span className="text-sm text-muted-foreground">
                {language ? t[levelHintKeys[language][level]] : t.selectLanguageHint}
              </span>
            </span>
          </label>
        ))}
        <FieldError id="level-error" error={errors.level} t={t} />
      </fieldset>
      <fieldset className="flex flex-col gap-3" aria-describedby="focus-hint focus-error">
        <legend className="mb-3 font-semibold">{t.focus}</legend>
        <p id="focus-hint" className="text-sm text-muted-foreground">
          {t.focusHint}
        </p>
        {focusAreas.map((value) => (
          <Button
            key={value}
            type="button"
            variant={focus.includes(value) ? "secondary" : "outline"}
            className="min-h-11 w-full rounded-full"
            aria-pressed={focus.includes(value)}
            disabled={pending || (focus.length === 3 && !focus.includes(value))}
            onClick={() =>
              setFocus((current) =>
                current.includes(value)
                  ? current.filter((item) => item !== value)
                  : [...current, value],
              )
            }
          >
            {t[value]}
          </Button>
        ))}
        {focus.map((value) => (
          <input key={value} type="hidden" name="focus" value={value} />
        ))}
        <FieldError id="focus-error" error={errors.focus} t={t} />
      </fieldset>
      <FieldError id="form-error" error={errors.form} t={t} />
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending ? t.saving : t.createJournal}
      </Button>
    </form>
  );
}
