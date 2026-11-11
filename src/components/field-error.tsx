import type { Dictionary } from "@/i18n/types";
import type { ErrorKey } from "@/lib/journal/action-input";

export function FieldError({ error, t, id }: { error?: ErrorKey; t: Dictionary; id: string }) {
  return error ? (
    <p id={id} role="alert" className="text-sm text-destructive">
      {t[error]}
    </p>
  ) : null;
}
