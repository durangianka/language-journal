"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { restoreDeletedAction } from "@/app/journals/feedback-actions";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/types";
import { deleteEntry, deleteJournal } from "@/lib/feedback-client";

export function DeleteActions({
  id,
  kind,
  date,
  returnTo,
  t,
  onEdit,
}: {
  id: string;
  kind: "entry" | "journal";
  date?: string;
  returnTo: string;
  t: Dictionary;
  onEdit?: () => void;
}) {
  const router = useRouter();
  const menuTrigger = useRef<HTMLButtonElement>(null);
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
      if (mode === "soft") {
        toast(kind === "entry" ? t.entryMovedToTrash : t.journalMovedToTrash, {
          duration: 10000,
          action: {
            label: t.undo,
            onClick: async () => {
              try {
                const restored = await restoreDeletedAction(id, kind);
                if (!restored.success) {
                  toast.error(t.restoreFailed);
                  return;
                }
                toast.success(t.restored);
                router.push(kind === "entry" ? returnTo : `/journals/${id}`);
                router.refresh();
              } catch {
                toast.error(t.restoreFailed);
              }
            },
          },
        });
      }
      router.push(`${returnTo}?deleted=${kind}-${mode}`);
      router.refresh();
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
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              ref={menuTrigger}
              variant="outline"
              className="min-h-11 w-full"
              disabled={busy}
            />
          }
        >
          {kind === "entry" ? t.entryActions : t.journalActions}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            {onEdit && (
              <DropdownMenuItem className="min-h-11" disabled={busy} onClick={onEdit}>
                {t.editEntry}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="min-h-11"
              disabled={busy}
              onClick={() => void remove("soft")}
            >
              {t.moveToTrash}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11"
              variant="destructive"
              disabled={busy}
              onClick={() => setOpen(true)}
            >
              {t.deletePermanently}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogRoot
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <AlertDialogContent finalFocus={menuTrigger}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {kind === "entry"
                ? `${t.deletePermanentlyTitle} ${date ?? ""}`
                : t.deleteJournalTitle}
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
