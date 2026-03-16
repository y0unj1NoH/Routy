export type ScheduleStatus = "ongoing" | "upcoming" | "past";

export type ScheduleDateRange = {
  startDate: string;
  endDate: string;
};

export const UPCOMING_SOON_THRESHOLD_DAYS = 3;

export function toDayTimestamp(value: string | Date | null | undefined) {
  if (!value) return Number.NaN;

  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return Number.NaN;

  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime();
}

export function isSameDay(left: string | Date | null | undefined, right: string | Date | null | undefined) {
  const leftTimestamp = toDayTimestamp(left);
  const rightTimestamp = toDayTimestamp(right);

  if (!Number.isFinite(leftTimestamp) || !Number.isFinite(rightTimestamp)) return false;
  return leftTimestamp === rightTimestamp;
}

export function getTodayTimestamp() {
  return toDayTimestamp(new Date());
}

export function getDaysUntilScheduleStart(startDate: string) {
  const todayTimestamp = getTodayTimestamp();
  const startTimestamp = toDayTimestamp(startDate);

  if (!Number.isFinite(todayTimestamp) || !Number.isFinite(startTimestamp)) return Number.NaN;
  return Math.round((startTimestamp - todayTimestamp) / (24 * 60 * 60 * 1000));
}

export function getScheduleDdayLabel(startDate: string, maxDays = UPCOMING_SOON_THRESHOLD_DAYS) {
  const diffDays = getDaysUntilScheduleStart(startDate);

  if (!Number.isFinite(diffDays) || diffDays < 0 || diffDays > maxDays) return null;
  return diffDays === 0 ? "D-Day" : `D-${diffDays}`;
}

export function getScheduleStatus(startDate: string, endDate: string): ScheduleStatus {
  const todayTimestamp = getTodayTimestamp();
  const startTimestamp = toDayTimestamp(startDate);
  const endTimestamp = toDayTimestamp(endDate);

  if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) return "upcoming";
  if (endTimestamp < todayTimestamp) return "past";
  if (startTimestamp > todayTimestamp) return "upcoming";
  return "ongoing";
}

export function sortSchedulesForHome<T extends ScheduleDateRange>(left: T, right: T) {
  const order: Record<ScheduleStatus, number> = {
    ongoing: 0,
    upcoming: 1,
    past: 2
  };

  const leftStatus = getScheduleStatus(left.startDate, left.endDate);
  const rightStatus = getScheduleStatus(right.startDate, right.endDate);

  if (leftStatus !== rightStatus) return order[leftStatus] - order[rightStatus];

  if (leftStatus === "past") {
    return toDayTimestamp(right.endDate) - toDayTimestamp(left.endDate);
  }

  if (leftStatus === "ongoing") {
    return toDayTimestamp(left.endDate) - toDayTimestamp(right.endDate);
  }

  return toDayTimestamp(left.startDate) - toDayTimestamp(right.startDate);
}

export function sortSchedulesForCalendar<T extends ScheduleDateRange>(left: T, right: T) {
  const startDiff = toDayTimestamp(left.startDate) - toDayTimestamp(right.startDate);
  if (startDiff !== 0) return startDiff;

  return toDayTimestamp(right.endDate) - toDayTimestamp(left.endDate);
}

export function sortPastSchedulesByRecentEnd<T extends ScheduleDateRange>(left: T, right: T) {
  return toDayTimestamp(right.endDate) - toDayTimestamp(left.endDate);
}

export function doesScheduleOverlapDate<T extends ScheduleDateRange>(schedule: T, date: string | Date) {
  const dayTimestamp = toDayTimestamp(date);
  const startTimestamp = toDayTimestamp(schedule.startDate);
  const endTimestamp = toDayTimestamp(schedule.endDate);

  if (!Number.isFinite(dayTimestamp) || !Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) return false;
  return dayTimestamp >= startTimestamp && dayTimestamp <= endTimestamp;
}

export function doesScheduleOverlapMonth<T extends ScheduleDateRange>(schedule: T, monthDate: Date) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

  const startTimestamp = toDayTimestamp(schedule.startDate);
  const endTimestamp = toDayTimestamp(schedule.endDate);
  const monthStartTimestamp = toDayTimestamp(monthStart);
  const monthEndTimestamp = toDayTimestamp(monthEnd);

  if (
    !Number.isFinite(startTimestamp) ||
    !Number.isFinite(endTimestamp) ||
    !Number.isFinite(monthStartTimestamp) ||
    !Number.isFinite(monthEndTimestamp)
  ) {
    return false;
  }

  return endTimestamp >= monthStartTimestamp && startTimestamp <= monthEndTimestamp;
}
