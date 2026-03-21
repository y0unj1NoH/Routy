import { UI_COPY } from "@/constants/ui-copy";

export type OpeningPoint = {
  day: number;
  hour: number;
  minute: number;
};

export type OpeningPeriod = {
  open: OpeningPoint | null;
  close: OpeningPoint | null;
};

export type ParsedOpeningHours = {
  openNow: boolean | null;
  weekdayDescriptions: string[];
  periods: OpeningPeriod[];
};

export type PlaceOpeningHint = {
  status: "open" | "closed" | "unknown";
  statusLabel: string;
  closesInMinutes: number | null;
  warningText: string | null;
};

function normalizeOpeningPoint(value: unknown): OpeningPoint | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const day = Number(source.day);
  const hour = Number(source.hour);
  const minute = Number(source.minute);
  if (!Number.isFinite(day) || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { day, hour, minute };
}

export function parseOpeningHours(rawOpeningHours: unknown): ParsedOpeningHours {
  if (!rawOpeningHours || typeof rawOpeningHours !== "object") {
    return {
      openNow: null,
      weekdayDescriptions: [],
      periods: []
    };
  }

  const source = rawOpeningHours as Record<string, unknown>;
  const rawOpenNow = source.openNow ?? source.open_now;
  const openNow = typeof rawOpenNow === "boolean" ? rawOpenNow : null;
  const weekdayDescriptionsRaw = (
    Array.isArray(source.weekdayDescriptions) ? source.weekdayDescriptions : source.weekday_text
  ) as unknown;

  const periods = (Array.isArray(source.periods) ? source.periods : [])
    .map((period) => {
      if (!period || typeof period !== "object") return null;
      const typed = period as Record<string, unknown>;
      return {
        open: normalizeOpeningPoint(typed.open),
        close: normalizeOpeningPoint(typed.close)
      } satisfies OpeningPeriod;
    })
    .filter((period): period is OpeningPeriod => Boolean(period));

  return {
    openNow,
    weekdayDescriptions: Array.isArray(weekdayDescriptionsRaw)
      ? weekdayDescriptionsRaw.filter((item): item is string => typeof item === "string")
      : [],
    periods
  };
}

function toNextDateFromPoint(point: OpeningPoint, now: Date) {
  const target = new Date(now);
  const dayOffset = (point.day - now.getDay() + 7) % 7;
  target.setDate(now.getDate() + dayOffset);
  target.setHours(point.hour, point.minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 7);
  }
  return target;
}

function getNextClosingMinutes(periods: OpeningPeriod[], now = new Date()) {
  const nextCloses = periods
    .map((period) => period.close)
    .filter((point): point is OpeningPoint => Boolean(point))
    .map((point) => toNextDateFromPoint(point, now))
    .map((date) => Math.round((date.getTime() - now.getTime()) / 60000))
    .filter((minutes) => minutes > 0)
    .sort((a, b) => a - b);

  return nextCloses.length > 0 ? nextCloses[0] : null;
}

export function buildPlaceOpeningHint(rawOpeningHours: unknown): PlaceOpeningHint {
  const parsed = parseOpeningHours(rawOpeningHours);

  if (parsed.openNow == null) {
    return {
      status: "unknown",
      statusLabel: UI_COPY.placeOpening.noInfo,
      closesInMinutes: null,
      warningText: null
    };
  }

  if (!parsed.openNow) {
    return {
      status: "closed",
      statusLabel: UI_COPY.placeOpening.closed,
      closesInMinutes: null,
      warningText: null
    };
  }

  const closesInMinutes = getNextClosingMinutes(parsed.periods);
  let warningText: string | null = null;
  if (closesInMinutes != null && closesInMinutes <= 60) {
    warningText = UI_COPY.placeOpening.closingInMinutes(closesInMinutes);
  } else if (closesInMinutes != null && closesInMinutes <= 120) {
    warningText = UI_COPY.placeOpening.closingSoon;
  }

  return {
    status: "open",
    statusLabel: UI_COPY.placeOpening.open,
    closesInMinutes,
    warningText
  };
}
