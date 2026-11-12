"use client";

import { useSearchParams } from "next/navigation";
import type { Dictionary } from "@/i18n/types";

export function DeletedNotice({ t }: { t: Dictionary }) {
  const query = useSearchParams().get("deleted");
  const labels: Record<string, string> = {
    "entry-soft": t.entryMovedToTrash,
    "entry-hard": t.entryDeletedPermanently,
    "journal-soft": t.journalMovedToTrash,
    "journal-hard": t.journalDeletedPermanently,
  };
  return query && Object.hasOwn(labels, query) ? (
    <p role="status" className="rounded-xl border p-4">
      {labels[query]}
    </p>
  ) : null;
}
