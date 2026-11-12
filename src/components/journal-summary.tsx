"use client";

import { useState, useTransition } from "react";
import { summariseJournalAction } from "@/app/journals/insight-actions";
import type { Dictionary } from "@/i18n/types";
import { Button } from "./ui/button";

export function JournalSummary({
  journalId,
  initialSummary,
  t,
}: {
  journalId: string;
  initialSummary: string | null;
  t: Dictionary;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full"
        disabled={pending || Boolean(summary)}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await summariseJournalAction(journalId);
              if (result.summary) setSummary(result.summary);
              setNotice(
                result.summary
                  ? ""
                  : result.reason === "daily"
                    ? t.insightDailyLimit
                    : result.reason === "empty"
                      ? t.insightEmpty
                      : t.insightFailed,
              );
            } catch {
              setNotice(t.insightFailed);
            }
          })
        }
      >
        {pending ? t.insightPending : t.summariseJournal}
      </Button>
      <div aria-live="polite" className="break-words text-sm [overflow-wrap:anywhere]">
        {summary ?? notice}
      </div>
    </>
  );
}
