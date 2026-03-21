import type { Place, ScheduleStayRecommendation } from "@/types/domain";

export type RouteStayOverlayMode = "stay" | "recommendation";
const MIN_STAY_RECOMMENDATION_RADIUS_KM = 0.8;
const MAX_STAY_RECOMMENDATION_RADIUS_KM = 1.8;

export type RouteStayMarker = {
  lat: number;
  lng: number;
  name: string | null;
};

export function getRouteStayMarker(stayPlace: Place | null): RouteStayMarker | null {
  if (!stayPlace) return null;
  if (typeof stayPlace.lat !== "number" || typeof stayPlace.lng !== "number") return null;
  return {
    lat: stayPlace.lat,
    lng: stayPlace.lng,
    name: stayPlace.name
  };
}

export function getRouteStayRecommendation(
  stayRecommendation: ScheduleStayRecommendation | null
): ScheduleStayRecommendation | null {
  if (!stayRecommendation) return null;
  if (
    typeof stayRecommendation.centerLat !== "number" ||
    typeof stayRecommendation.centerLng !== "number" ||
    typeof stayRecommendation.radiusKm !== "number"
  ) {
    return null;
  }

  return {
    ...stayRecommendation,
    radiusKm: Math.max(
      MIN_STAY_RECOMMENDATION_RADIUS_KM,
      Math.min(MAX_STAY_RECOMMENDATION_RADIUS_KM, stayRecommendation.radiusKm)
    )
  };
}

export function getRouteStayOverlayMode({
  stayPlace,
  stayRecommendation
}: {
  stayPlace: Place | null;
  stayRecommendation: ScheduleStayRecommendation | null;
}): RouteStayOverlayMode | null {
  if (getRouteStayMarker(stayPlace)) {
    return "stay";
  }

  if (getRouteStayRecommendation(stayRecommendation)) {
    return "recommendation";
  }

  return null;
}
