"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialogRoot,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/types";
import { deleteEntry, deleteJournal } from "@/lib/feedback-client";

export function DeleteActions({
  id,
  kind,
  date,
  returnTo,
  t,
}: {
  id: string;
  kind: "entry" | "journal";
  date?: string;
  returnTo: string;
  t: Dictionary;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function remove(mode: "soft" | "hard") {
    setBusy(true);
    setError(false);
    try {
      const result = await (kind === "entry" ? deleteEntry(id, mode) : deleteJournal(id, mode));
      if (!result.success) {
        setError(true);
        setBusy(false);
        return;
      }
      setOpen(false);
      router.push(`${returnTo}?deleted=${kind}-${mode}`);
    } catch {
      setError(true);
      setBusy(false);
    }
  }
  return (
    <section
      aria-label={kind === "entry" ? t.entryActions : t.journalActions}
      className="mt-6 flex flex-col gap-3 border-t pt-6"
    >
      <h2 className="font-semibold">{kind === "entry" ? t.entryActions : t.journalActions}</h2>
      <p className="text-sm text-muted-foreground">{t.feedbackDemoNotice}</p>
      <Button
        variant="secondary"
        className="min-h-11 w-full"
        disabled={busy}
        onClick={() => void remove("soft")}
      >
        {t.moveToTrash}
      </Button>
      <AlertDialogRoot
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <AlertDialogTrigger
          render={<Button variant="destructive" className="min-h-11 w-full" disabled={busy} />}
        >
          {t.deletePermanently}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {kind === "entry" ? t.deletePermanentlyTitle : t.deleteJournalTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {kind === "entry"
                ? t.deletePermanentlyWarning.replace("{date}", date ?? "")
                : t.deleteJournalWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p role="alert">{t.deleteFailed}</p>}
          <AlertDialogFooter className="sm:flex-col">
            <AlertDialogCancel className="min-h-11 w-full whitespace-normal" disabled={busy}>
              {t.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="min-h-11 w-full whitespace-normal"
              disabled={busy}
              onClick={() => void remove("hard")}
            >
              {t.confirmDeletePermanently}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>
      {error && !open && <p role="alert">{t.deleteFailed}</p>}
    </section>
  );
}
