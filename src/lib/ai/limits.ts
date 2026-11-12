import { LIMITS } from "../feedback-contract";
export const dailyCallCap = LIMITS.dailyModelCalls;
export const entryRequestCap = LIMITS.feedbackPerEntry;
export function requestLimit(
  entryRequests: number,
  dailyCalls: number,
): "entry_limit_reached" | "daily_cap_reached" | null {
  if (entryRequests >= entryRequestCap) return "entry_limit_reached";
  if (dailyCalls >= dailyCallCap) return "daily_cap_reached";
  return null;
}
