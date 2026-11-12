"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { JevNote } from "@/lib/jev/contract";
import { useRouter, useSearchParams } from "next/navigation";
import { createEntryAction } from "@/app/journals/actions";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/types";
import type { ActionResult } from "@/lib/journal/action-input";
import { today } from "@/lib/journal/dates";

const subscribe = () => () => {};
const serverDate = () => "";

export function EntryForm({ journalId, t }: { journalId: string; t: Dictionary }) {
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
  const [body, setBody] = useState("");
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
  const [selectedDate, setEntryDate] = useState<string | null>(() =>
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : null,
  );
  const entryDate = selectedDate ?? localToday;
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_previous, form) => {
      const result = await createEntryAction(form);
      if (result.success) router.push(`/journals/${journalId}?saved=${result.id}`);
      return result;
    },
    null,
  );
  const errors = state && !state.success ? state.errors : {};

  return (
    <form ref={formRef} action={action} className="writing-form flex min-h-0 flex-1 flex-col gap-2">
      <input type="hidden" name="journalId" value={journalId} />
      <div className="grid grid-cols-[auto_1fr] items-center gap-3">
        <label htmlFor="entry-date" className="flex min-h-11 items-center font-semibold">
          {t.entryDate}
        </label>
        <input
          id="entry-date"
          type="date"
          name="entryDate"
          className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-base focus-visible:outline-2"
          value={entryDate}
          onChange={(event) => setEntryDate(event.target.value)}
          required
          aria-invalid={Boolean(errors.entryDate)}
          aria-describedby="date-error"
        />
      </div>
      <FieldError id="date-error" error={errors.entryDate} t={t} />
      <label htmlFor="entry-body" className="flex min-h-11 items-center font-semibold">
        {t.yourEntry}
      </label>
      <Textarea
        id="entry-body"
        name="body"
        className="min-h-16 flex-1 resize-none overflow-y-auto text-base [field-sizing:fixed]"
        value={body}
        onChange={(event) => {
          revision.current += 1;
          setJudgement(null);
          setBody(Array.from(event.target.value).slice(0, 2000).join(""));
        }}
        onBlur={() => void judgeOnBlur()}
        required
        aria-invalid={Boolean(errors.body)}
        aria-describedby="character-count body-error jev-note"
      />
      <div id="jev-note" aria-live="polite" className="text-sm text-muted-foreground">
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
        <p id="character-count">
          {Array.from(body).length} / 2000 {t.characters}
        </p>
      </div>
      <FieldError id="body-error" error={errors.body} t={t} />
      <FieldError id="journal-error" error={errors.journalId} t={t} />
      <FieldError id="form-error" error={errors.form} t={t} />
      <div className="writing-save shrink-0 bg-background py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button type="submit" className="min-h-11 w-full" disabled={pending || !entryDate}>
          {pending ? t.saving : t.saveEntry}
        </Button>
      </div>
    </form>
  );
}
