import { UI_COPY } from "@/constants/ui-copy";
import type { ScheduleStop } from "@/types/domain";

export type RouteTravelInfo = {
  modeLabel: string;
  durationLabel: string;
  distanceLabel: string;
  icon: "walk" | "bus" | "subway";
};

function haversineDistanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (degree: number) => (degree * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const v1 = Math.sin(dLat / 2) * Math.sin(dLat / 2);
  const v2 = Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const arc = 2 * Math.atan2(Math.sqrt(v1 + v2), Math.sqrt(1 - (v1 + v2)));
  return earthRadiusKm * arc;
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return "-";
  if (distanceKm < 1) return `${Math.max(50, Math.round(distanceKm * 1000))}m`;
  return `${distanceKm.toFixed(1)}km`;
}

export function inferRouteTravelInfo(stop: ScheduleStop, nextStop: ScheduleStop | null | undefined): RouteTravelInfo | null {
  if (!nextStop) return null;

  const currentLat = stop.place.lat;
  const currentLng = stop.place.lng;
  const nextLat = nextStop.place.lat;
  const nextLng = nextStop.place.lng;

  const distanceKm =
    typeof currentLat === "number" &&
    typeof currentLng === "number" &&
    typeof nextLat === "number" &&
    typeof nextLng === "number"
      ? haversineDistanceKm(currentLat, currentLng, nextLat, nextLng)
      : null;

  const rawMode = String(stop.transportToNext?.mode || "")
    .trim()
    .toUpperCase();
  const rawDistance = String(stop.transportToNext?.distance || "").trim();
  const rawDuration = String(stop.transportToNext?.duration || "").trim();

  const walkMode = /WALK|FOOT|도보|걷/i.test(rawMode);
  const subwayMode = /SUBWAY|METRO|TRAIN|지하철/i.test(rawMode);
  const transitMode = /BUS|TRANSIT|PUBLIC|대중교통/i.test(rawMode);

  let icon: RouteTravelInfo["icon"] = "bus";
  let modeLabel: RouteTravelInfo["modeLabel"] = UI_COPY.routes.detail.travelModes.transit;
  if (walkMode) {
    icon = "walk";
    modeLabel = UI_COPY.routes.detail.travelModes.walk;
  } else if (subwayMode) {
    icon = "subway";
    modeLabel = UI_COPY.routes.detail.travelModes.subway;
  } else if (transitMode) {
    icon = "bus";
    modeLabel = UI_COPY.routes.detail.travelModes.transit;
  } else if (distanceKm != null && distanceKm <= 1.2) {
    icon = "walk";
    modeLabel = UI_COPY.routes.detail.travelModes.walk;
  }

  const fallbackDurationMinutes =
    distanceKm == null
      ? null
      : icon === "walk"
        ? Math.max(4, Math.round((distanceKm / 4.3) * 60))
        : Math.max(8, Math.round((distanceKm / 22) * 60 + 6));

  return {
    icon,
    modeLabel,
    durationLabel: rawDuration || (fallbackDurationMinutes != null ? `${fallbackDurationMinutes}분` : "-"),
    distanceLabel: rawDistance || formatDistance(distanceKm)
  };
}

export function getPreferredRouteFocusBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
