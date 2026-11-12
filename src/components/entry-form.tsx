"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Save } from "lucide-react";
import type { JevNote } from "@/lib/jev/contract";
import { useRouter, useSearchParams } from "next/navigation";
import { createEntryAction, updateEntryAction } from "@/app/journals/actions";
import { EntryDatePicker } from "@/components/entry-date-picker";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedWriting } from "@/components/unsaved-writing";
import type { Dictionary, Locale } from "@/i18n/types";
import type { EntryDto } from "@/lib/feedback-contract";
import type { ActionResult } from "@/lib/journal/action-input";
import { today } from "@/lib/journal/dates";
import { createEntrySchema } from "@/lib/journal/schemas";
import { cn } from "cn";

const subscribe = () => () => {};
const serverDate = () => "";

export function EntryForm({
  journalId,
  t,
  locale,
  initialEntry,
  onSaved,
  onCancel,
}: {
  journalId: string;
  t: Dictionary;
  locale: Locale;
  initialEntry?: EntryDto;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const fieldId = (name: string) => (initialEntry ? `${initialEntry.id}-${name}` : name);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    function updateKeyboard() {
      if (!viewport || !formRef.current) return;
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      formRef.current.style.setProperty("--keyboard-inset", `${inset}px`);
      formRef.current.dataset.keyboardOpen = String(inset > 100);
    }
    viewport.addEventListener("resize", updateKeyboard);
    viewport.addEventListener("scroll", updateKeyboard);
    return () => {
      viewport.removeEventListener("resize", updateKeyboard);
      viewport.removeEventListener("scroll", updateKeyboard);
    };
  }, []);
  const requestedDate = useSearchParams().get("date");
  const [body, setBody] = useState(initialEntry?.body ?? "");
  const [judgement, setJudgement] = useState<JevNote | null>(null);
  const revision = useRef(0);
  const lastChecked = useRef("");
  async function judgeOnBlur() {
    if (Array.from(body.trim()).length < 40 || lastChecked.current === body) return;
    lastChecked.current = body;
    const currentRevision = revision.current;
    try {
      const response = await fetch("/api/jev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalId, text: body }),
        signal: AbortSignal.timeout(5000),
      });
      const note: JevNote | null = response.ok ? await response.json() : null;
      if (revision.current === currentRevision) setJudgement(note);
    } catch {
      if (revision.current === currentRevision) setJudgement(null);
    }
  }
  // The server cannot know the device timezone. Leave the date blank until hydration.
  const localToday = useSyncExternalStore(subscribe, today, serverDate);
  const [selectedDate, setEntryDate] = useState<string | null>(
    () =>
      initialEntry?.entryDate ??
      (requestedDate && createEntrySchema.shape.entryDate.safeParse(requestedDate).success
        ? requestedDate
        : null),
  );
  const entryDate = selectedDate ?? localToday;
  const allowLeave = useUnsavedWriting(
    body !== (initialEntry?.body ?? "") ||
      (Boolean(initialEntry) && entryDate !== initialEntry?.entryDate),
    t.unsavedChanges,
  );
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_previous, form) => {
      const result = await (initialEntry ? updateEntryAction(form) : createEntryAction(form));
      if (result.success) {
        allowLeave();
        if (initialEntry) {
          router.refresh();
          onSaved?.();
        } else {
          setBody("");
          setEntryDate(null);
          setJudgement(null);
          lastChecked.current = "";
          revision.current += 1;
          router.push(`/journals/${journalId}/entries/${result.id}`);
        }
      }
      return result;
    },
    null,
  );
  const errors = state && !state.success ? state.errors : {};

  return (
    <form ref={formRef} action={action} className="writing-form flex min-h-0 flex-1 flex-col gap-2">
      <input type="hidden" name="journalId" value={journalId} />
      {initialEntry && <input type="hidden" name="entryId" value={initialEntry.id} />}
      <div className="grid grid-cols-[auto_1fr] items-center gap-3">
        <label
          id={`${fieldId("entry-date")}-label`}
          htmlFor={fieldId("entry-date")}
          className="flex min-h-11 items-center font-semibold"
        >
          {t.entryDate}
        </label>
        <EntryDatePicker
          id={fieldId("entry-date")}
          errorId={fieldId("date-error")}
          value={entryDate}
          onChange={setEntryDate}
          locale={locale}
          invalid={Boolean(errors.entryDate)}
          t={t}
        />
      </div>
      <FieldError id={fieldId("date-error")} error={errors.entryDate} t={t} />
      <label htmlFor={fieldId("entry-body")} className="flex min-h-11 items-center font-semibold">
        {t.yourEntry}
      </label>
      <Textarea
        id={fieldId("entry-body")}
        name="body"
        className={cn(
          "journal-prose min-h-50 w-full max-w-none flex-1 resize-y overflow-y-auto [field-sizing:fixed]",
          initialEntry && "min-h-64",
        )}
        value={body}
        onChange={(event) => {
          revision.current += 1;
          setJudgement(null);
          setBody(Array.from(event.target.value).slice(0, 2000).join(""));
        }}
        onBlur={() => void judgeOnBlur()}
        required
        autoFocus={Boolean(initialEntry)}
        aria-invalid={Boolean(errors.body)}
        aria-describedby={`${fieldId("character-count")} ${fieldId("body-error")} ${fieldId("jev-note")}`}
      />
      <div id={fieldId("jev-note")} aria-live="polite" className="text-sm text-muted-foreground">
        {judgement
          ? judgement.issue === "none"
            ? t.jevNoIssues
            : `${t[judgement.issue]}. ${t.jevDetails}`
          : null}
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {body.trim() ? body.trim().split(/\s+/u).length : 0} {t.words}
        </p>
        <p id={fieldId("character-count")}>
          {Array.from(body).length} / 2000 {t.characters}
        </p>
      </div>
      <FieldError id={fieldId("body-error")} error={errors.body} t={t} />
      <FieldError id={fieldId("journal-error")} error={errors.journalId} t={t} />
      <FieldError id={fieldId("form-error")} error={errors.form} t={t} />
      <div className="writing-save flex shrink-0 gap-3 bg-background py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 min-w-11 shrink-0"
            disabled={pending}
            onClick={onCancel}
          >
            {t.cancel}
          </Button>
        )}
        <Button type="submit" className="min-h-11 min-w-0 flex-1" disabled={pending || !entryDate}>
          <Save aria-hidden="true" />
          {pending ? t.saving : t.saveEntry}
        </Button>
      </div>
    </form>
  );
}
