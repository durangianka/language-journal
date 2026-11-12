"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { restoreDeletedAction } from "@/app/journals/feedback-actions";
import { deleteEntry, deleteJournal } from "@/lib/feedback-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialogRoot,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { languageLabelKeys } from "@/config/domain";
import { formatDate } from "@/lib/journal/dates";
import type { TrashItem } from "@/lib/journal/trash";
import type { Dictionary, Locale } from "@/i18n/types";

export function TrashList({
  items,
  t,
  locale,
}: {
  items: TrashItem[];
  t: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  async function restore(item: TrashItem) {
    setBusy(true);
    try {
      const result = await restoreDeletedAction(item.id, item.kind);
      if (!result.success) throw new Error("Restore failed");
      toast.success(t.restored);
      router.refresh();
    } catch {
      toast.error(t.restoreFailed);
    } finally {
      setBusy(false);
    }
  }
  async function empty() {
    setBusy(true);
    try {
      for (const item of items) {
        const result = await (item.kind === "entry"
          ? deleteEntry(item.id, "hard")
          : deleteJournal(item.id, "hard"));
        if (!result.success) throw new Error("Delete failed");
      }
      setOpen(false);
    } catch {
      toast.error(t.deleteFailed);
    } finally {
      router.refresh();
      setBusy(false);
    }
  }
  if (!items.length)
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <Trash2
            aria-hidden="true"
            className="size-12 rounded-xl bg-accent p-3 text-accent-foreground"
          />
          <p>{t.trashEmpty}</p>
        </CardContent>
      </Card>
    );
  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t[languageLabelKeys[item.language]]}
                    {item.entryDate ? ` · ${formatDate(item.entryDate, locale)}` : ""}
                  </p>
                  <p className="mt-1 line-clamp-2 break-words font-semibold [overflow-wrap:anywhere]">
                    {item.body ?? t.journals}
                  </p>
                </div>
                <Button variant="ghost" disabled={busy} onClick={() => void restore(item)}>
                  <RotateCcw aria-hidden="true" />
                  {t.restore}
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      <Button
        ref={trigger}
        variant="destructive"
        disabled={busy}
        onClick={() => setOpen(true)}
        className="self-start"
      >
        <Trash2 aria-hidden="true" />
        {t.emptyTrash}
      </Button>
      <AlertDialogRoot
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <AlertDialogContent finalFocus={trigger}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.emptyTrash}</AlertDialogTitle>
            <AlertDialogDescription>{t.emptyTrashWarning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2">
            <AlertDialogCancel className="min-w-0 whitespace-normal" disabled={busy}>
              {t.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-w-0 whitespace-normal"
              variant="destructive"
              disabled={busy}
              onClick={() => void empty()}
            >
              {t.confirmDeletePermanently}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>
    </>
  );
}
