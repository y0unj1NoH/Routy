"use client";

import type { CanonicalRouteStopLabel } from "@/constants/route-taxonomy";

const ROUTE_STOP_LABEL_FALLBACK: CanonicalRouteStopLabel = "VISIT";

export function buildCanonicalRouteStopLabel(index: number, total: number): CanonicalRouteStopLabel {
  if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0) {
    return ROUTE_STOP_LABEL_FALLBACK;
  }

  if (total === 1) {
    return "VISIT";
  }

  if (total === 2) {
    return index === 0 ? "LUNCH" : "DINNER";
  }

  if (total === 3) {
    return ["LUNCH", "VISIT", "DINNER"][index] as CanonicalRouteStopLabel;
  }

  if (total === 4) {
    return ["MORNING", "LUNCH", "VISIT", "DINNER"][index] as CanonicalRouteStopLabel;
  }

  if (total === 5) {
    return ["MORNING", "LUNCH", "VISIT", "DESSERT", "DINNER"][index] as CanonicalRouteStopLabel;
  }

  const labels: CanonicalRouteStopLabel[] = ["MORNING", "LUNCH"];
  const middleVisitCount = Math.max(0, total - 5);

  for (let visitIndex = 0; visitIndex < middleVisitCount; visitIndex += 1) {
    labels.push("VISIT");
  }

  labels.push("DESSERT", "DINNER", "NIGHT");
  return labels[index] || ROUTE_STOP_LABEL_FALLBACK;
}
