import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  checkJevText,
  clearJevPause,
  scheduleJevPause,
  type JevCheckSchedule,
} from "../../src/lib/jev/check-schedule";

let schedule: JevCheckSchedule;
const check = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  check.mockClear();
  schedule = { lastText: null, timer: null };
});
afterEach(() => vi.useRealTimers());

test("unchanged blur makes no additional call, even after time passes", () => {
  checkJevText(schedule, "A complete sentence.", check);
  vi.advanceTimersByTime(8000);
  checkJevText(schedule, "A complete sentence.", check);
  expect(check).toHaveBeenCalledExactlyOnceWith("A complete sentence.");
});

test("typing pause checks only after 2.5 seconds, resetting on each keystroke", () => {
  scheduleJevPause(schedule, "First sentence.", check);
  vi.advanceTimersByTime(2499);
  expect(check).not.toHaveBeenCalled();
  scheduleJevPause(schedule, "Latest sentence.", check);
  vi.advanceTimersByTime(2499);
  expect(check).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(check).toHaveBeenCalledExactlyOnceWith("Latest sentence.");
});

test("an unchanged typing pause is skipped and exactly eight characters are eligible", () => {
  scheduleJevPause(schedule, "12345678", check);
  vi.advanceTimersByTime(2500);
  scheduleJevPause(schedule, "12345678", check);
  vi.advanceTimersByTime(2500);
  expect(check).toHaveBeenCalledExactlyOnceWith("12345678");
});

test("consecutive changed pauses and blur check without a further time limit", () => {
  scheduleJevPause(schedule, "First sentence.", check);
  vi.advanceTimersByTime(2500);
  scheduleJevPause(schedule, "Second sentence.", check);
  vi.advanceTimersByTime(2500);
  checkJevText(schedule, "Second sentence.", check);
  expect(check).toHaveBeenCalledTimes(2);
  checkJevText(schedule, "Second sentence. Added text.", check);
  expect(check).toHaveBeenCalledTimes(3);
  checkJevText(schedule, "Second sentence.", check);
  expect(check).toHaveBeenCalledTimes(4);
});

test.each(["1234567", " 1234567 ", "😀😀😀😀😀😀😀"])("short text %s never checks", (text) => {
  scheduleJevPause(schedule, text, check);
  vi.advanceTimersByTime(2500);
  checkJevText(schedule, text, check);
  expect(check).not.toHaveBeenCalled();
});

test("blur cancels the pending pause and cleanup prevents a pending call", () => {
  scheduleJevPause(schedule, "First sentence.", check);
  checkJevText(schedule, "First sentence.", check);
  vi.advanceTimersByTime(8000);
  expect(check).toHaveBeenCalledTimes(1);
  scheduleJevPause(schedule, "Second sentence.", check);
  clearJevPause(schedule);
  vi.advanceTimersByTime(8000);
  expect(check).toHaveBeenCalledTimes(1);
});
