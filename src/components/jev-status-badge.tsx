import { CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import type { Dictionary } from "@/i18n/types";
import type { JevNote } from "@/lib/jev/contract";

const issueKeys: Record<"grammar" | "vocabulary" | "spelling" | "style", keyof Dictionary> = {
  grammar: "jevGrammar",
  vocabulary: "jevVocabulary",
  spelling: "jevSpelling",
  style: "jevStyle",
};

export function JevStatusBadge({
  checking,
  judgement,
  t,
}: {
  checking: boolean;
  judgement: JevNote | null;
  t: Dictionary;
}) {
  if (!checking && !judgement) return null;

  const issue = judgement?.issue;
  const Icon = checking
    ? LoaderCircle
    : issue === "none"
      ? CircleCheck
      : issue === "uncertain"
        ? Info
        : TriangleAlert;
  const colour = checking
    ? "bg-muted text-muted-foreground"
    : issue === "none"
      ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200"
      : issue === "uncertain"
        ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
        : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
  const label = checking
    ? t.jevChecking
    : issue === "none"
      ? t.jevNoIssues
      : issue === "uncertain"
        ? t.jevUncertain
        : issue
          ? `${t[issueKeys[issue]]} ${t.jevDetails}`
          : "";

  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 rounded-xl px-3 py-1.5 text-sm ${colour}`}
    >
      <Icon
        aria-hidden="true"
        className={`size-4 shrink-0${checking ? " animate-spin motion-reduce:animate-none" : ""}`}
      />
      <span>{label}</span>
    </span>
  );
}
