"use client";

import { Toaster } from "sonner";

export function JournalToaster({ label }: { label: string }) {
  return (
    <Toaster
      position="bottom-center"
      containerAriaLabel={label}
      toastOptions={{
        classNames: { actionButton: "!min-h-11 !min-w-11", cancelButton: "!min-h-11 !min-w-11" },
      }}
    />
  );
}
