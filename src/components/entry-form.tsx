"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createEntryAction } from "@/app/journals/actions";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/types";
import type { ActionResult } from "@/lib/journal/action-input";

export function EntryForm({
  journalId,
  initialDate,
  t,
}: {
  journalId: string;
  initialDate: string;
  t: Dictionary;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [entryDate, setEntryDate] = useState(initialDate);
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
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="journalId" value={journalId} />
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
      <FieldError id="date-error" error={errors.entryDate} t={t} />
      <label htmlFor="entry-body" className="flex min-h-11 items-center font-semibold">
        {t.yourEntry}
      </label>
      <Textarea
        id="entry-body"
        name="body"
        className="min-h-64 text-base"
        value={body}
        onChange={(event) => setBody(Array.from(event.target.value).slice(0, 5000).join(""))}
        required
        aria-invalid={Boolean(errors.body)}
        aria-describedby="character-count body-error"
      />
      <p id="character-count" className="text-right text-sm text-muted-foreground">
        {Array.from(body).length} / 5000 {t.characters}
      </p>
      <FieldError id="body-error" error={errors.body} t={t} />
      <FieldError id="journal-error" error={errors.journalId} t={t} />
      <FieldError id="form-error" error={errors.form} t={t} />
      <Button type="submit" className="min-h-11 w-full" disabled={pending || !entryDate}>
        {pending ? t.saving : t.saveEntry}
      </Button>
    </form>
  );
}
