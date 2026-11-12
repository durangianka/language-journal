"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Languages, Plus, Signal } from "lucide-react";
import { useRouter } from "next/navigation";
import { createJournalAction } from "@/app/journals/actions";
import { FieldError } from "@/components/field-error";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FieldGroup, FieldSet, FieldLegend } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { languages, languageLabelKeys, levels, levelHintKeys } from "@/config/domain";
import { focusAreas, maxFocusByLevel } from "@/config/focus";
import type { Locale } from "@/config/locales";
import type { Dictionary } from "@/i18n/types";
import type { ActionResult } from "@/lib/journal/action-input";

export function JournalForm({ t }: { t: Dictionary }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [language, setLanguage] = useState<Locale | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<(typeof levels)[number] | null>(null);
  const [focus, setFocus] = useState<string[]>([]);
  const focusLimit = selectedLevel ? maxFocusByLevel[selectedLevel] : 0;
  const focusLimitReached = selectedLevel !== null && focus.length >= focusLimit;
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_previous, form) => {
      const result = await createJournalAction(form);
      if (result.success) router.push(`/journals/${result.id}`);
      return result;
    },
    null,
  );
  const errors = state && !state.success ? state.errors : {};
  useEffect(() => {
    if (state && !state.success) {
      formRef.current
        ?.querySelector<HTMLElement>(
          '[aria-invalid="true"] button, [aria-invalid="true"] [role="radio"], button[aria-invalid="true"]',
        )
        ?.focus();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      noValidate
      action={action}
      className="flex flex-col gap-8"
      // React resets radios even after a resolved failure. Success navigates away.
      onReset={(event) => event.preventDefault()}
    >
      <FieldGroup>
        <FieldSet aria-describedby="language-error">
          <FieldLegend className="flex items-center gap-2">
            <Languages aria-hidden="true" className="size-5" />
            {t.journalLanguage}
          </FieldLegend>
          <input type="hidden" name="language" value={language ?? ""} />
          <ToggleGroup
            aria-invalid={Boolean(errors.language)}
            aria-describedby="language-error"
            aria-label={t.chooseLanguage}
            variant="outline"
            className="w-full"
            value={language ? [language] : []}
            onValueChange={(values) => {
              const next = languages.find((value) => value === values[0]);
              if (next) setLanguage(next);
            }}
            disabled={pending}
          >
            {languages.map((value) => {
              const label = t[languageLabelKeys[value]];
              return (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  aria-label={label}
                  className="min-h-14 min-w-0 flex-1 flex-col gap-1 px-1"
                >
                  <span>{label}</span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <FieldError id="language-error" error={errors.language} t={t} />
        </FieldSet>
        <FieldSet aria-describedby="level-error">
          <FieldLegend className="flex items-center gap-2">
            <Signal aria-hidden="true" className="size-5" />
            {t.chooseLevel}
          </FieldLegend>
          <RadioGroup
            aria-invalid={Boolean(errors.level)}
            aria-describedby="level-error"
            name="level"
            value={selectedLevel ?? ""}
            aria-label={t.chooseLevel}
            disabled={pending}
            onValueChange={(value) => {
              const next = levels.find((level) => level === value);
              if (!next) return;
              setSelectedLevel(next);
              setFocus((current) => current.slice(0, maxFocusByLevel[next]));
            }}
          >
            {levels.map((level) => (
              <Card
                key={level}
                className="gap-0 py-0 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-muted"
              >
                <label
                  htmlFor={"level-" + level}
                  className="flex min-h-11 cursor-pointer items-center gap-3 p-4"
                >
                  <RadioGroupItem
                    id={"level-" + level}
                    value={level}
                    aria-label={t[level]}
                    className="size-11"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="font-medium">{t[level]}</span>
                    <span className="text-sm text-muted-foreground">
                      {language ? t[levelHintKeys[language][level]] : t.selectLanguageHint}
                    </span>
                  </span>
                </label>
              </Card>
            ))}
          </RadioGroup>
          <FieldError id="level-error" error={errors.level} t={t} />
        </FieldSet>
        <fieldset
          id="journal-focus"
          className="flex flex-col gap-3"
          aria-describedby="focus-hint focus-limit focus-error"
        >
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
              disabled={pending || !selectedLevel || (focusLimitReached && !focus.includes(value))}
              onClick={() => {
                if (!selectedLevel || (!focus.includes(value) && focus.length >= focusLimit))
                  return;
                setFocus((current) =>
                  current.includes(value)
                    ? current.filter((item) => item !== value)
                    : [...current, value],
                );
              }}
            >
              {t[value]}
            </Button>
          ))}
          {focus.map((value) => (
            <input key={value} type="hidden" name="focus" value={value} />
          ))}
          <p id="focus-limit" role="status" className="text-sm text-muted-foreground">
            {focusLimitReached ? t.focusLimitReached : null}
          </p>
          <FieldError id="focus-error" error={errors.focus} t={t} />
        </fieldset>
        <FieldError id="form-error" error={errors.form} t={t} />
      </FieldGroup>
      <div className="sticky bottom-0 bg-background py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button type="submit" className="min-h-11 w-full" disabled={pending}>
          <Plus aria-hidden="true" />
          {pending ? t.saving : t.createJournal}
        </Button>
      </div>
    </form>
  );
}
