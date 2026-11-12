import type { ActionResult, FeedbackDto } from "./feedback-contract";

export function feedbackScreenState(
  feedback: FeedbackDto | null,
  requesting = false,
  error: Extract<ActionResult<FeedbackDto>, { success: false }>["reason"] | null = null,
) {
  return {
    feedback,
    status: requesting ? "pending" : error ? "failed" : (feedback?.status ?? null),
    reason: error ?? feedback?.reason ?? null,
  };
}

export function feedbackResultState(
  result: ActionResult<FeedbackDto>,
  previous: FeedbackDto | null,
) {
  return result.success
    ? feedbackScreenState(result.data)
    : feedbackScreenState(previous, false, result.reason);
}
