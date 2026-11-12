import type { Dictionary } from "@/i18n/types";
import type { FeedbackDto } from "@/lib/feedback-contract";

export function feedbackStatusLabel(feedback: FeedbackDto | null, t: Dictionary) {
  switch (feedback?.status) {
    case "pending":
      return t.feedbackStatusPending;
    case "ready":
      return t.feedbackStatusReady;
    case "failed":
      return t.feedbackStatusFailed;
    default:
      return t.feedbackStatusNone;
  }
}

export function FeedbackStatus({ feedback, t }: { feedback: FeedbackDto | null; t: Dictionary }) {
  return <span className="text-sm text-muted-foreground">{feedbackStatusLabel(feedback, t)}</span>;
}
