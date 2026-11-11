"use client";

import { useEffect } from "react";

export function SavedNotice({ date, label }: { date: string | null; label: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("saved");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return date ? (
    <div
      role="status"
      className="min-h-11 rounded-xl border border-green-300 bg-green-50 p-5 text-green-900"
    >
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-sm">{date}</p>
    </div>
  ) : null;
}
