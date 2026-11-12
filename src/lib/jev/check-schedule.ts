export type JevCheckSchedule = {
  lastText: string | null;
  timer: ReturnType<typeof setTimeout> | null;
};

export function clearJevPause(schedule: JevCheckSchedule) {
  if (schedule.timer !== null) clearTimeout(schedule.timer);
  schedule.timer = null;
}

export function checkJevText(
  schedule: JevCheckSchedule,
  text: string,
  check: (text: string) => void,
) {
  clearJevPause(schedule);
  if (Array.from(text.trim()).length < 8 || text === schedule.lastText) return;
  schedule.lastText = text;
  check(text);
}

export function scheduleJevPause(
  schedule: JevCheckSchedule,
  text: string,
  check: (text: string) => void,
) {
  clearJevPause(schedule);
  schedule.timer = setTimeout(() => checkJevText(schedule, text, check), 2500);
}
