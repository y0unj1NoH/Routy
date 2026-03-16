import { UI_COPY } from "@/constants/ui-copy";
import { UPCOMING_SOON_THRESHOLD_DAYS } from "@/lib/schedule-status";

export function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} ~ ${endDate}`;
  }

  const formatter = new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric"
  });

  return `${formatter.format(start)} ~ ${formatter.format(end)}`;
}

export function formatDateLabel(date: string | null | undefined) {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short"
  }).format(parsed);
}

export type RelativeTripLabelKind =
  | "invalid"
  | "past_trip"
  | "ongoing_single_day"
  | "ongoing_multi_day"
  | "starting_today"
  | "upcoming_soon"
  | "upcoming";

export function getRelativeTripLabel(startDate: string, endDate?: string): { kind: RelativeTripLabelKind; text: string } {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return { kind: "invalid", text: UI_COPY.scheduleStatus.invalid };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);

  if (endDate) {
    const end = new Date(endDate);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(0, 0, 0, 0);

      if (end < today) {
        const elapsedDays = Math.round((today.getTime() - end.getTime()) / (24 * 60 * 60 * 1000));
        return { kind: "past_trip", text: UI_COPY.scheduleStatus.pastTripByEndDays(elapsedDays) };
      }

      if (start <= today && end >= today) {
        if (start.getTime() === end.getTime()) {
          return { kind: "ongoing_single_day", text: UI_COPY.scheduleStatus.todayDeparture };
        }
        return { kind: "ongoing_multi_day", text: UI_COPY.scheduleStatus.ongoing };
      }
    }
  }

  const diffMs = start.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    return { kind: "past_trip", text: UI_COPY.scheduleStatus.startedDaysAgo(Math.abs(diffDays)) };
  }
  if (diffDays === 0) {
    return { kind: "starting_today", text: UI_COPY.scheduleStatus.startingToday };
  }
  if (diffDays <= UPCOMING_SOON_THRESHOLD_DAYS) {
    return { kind: "upcoming_soon", text: UI_COPY.scheduleStatus.upcomingSoon };
  }
  return { kind: "upcoming", text: UI_COPY.scheduleStatus.upcomingInDays(diffDays) };
}

export function formatRelativeTripLabel(startDate: string, endDate?: string) {
  return getRelativeTripLabel(startDate, endDate).text;
}
