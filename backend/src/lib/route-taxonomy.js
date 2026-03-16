const routeTaxonomy = require("../../../shared/route-taxonomy.json");

const MUST_VISIT_BADGE = routeTaxonomy.mustVisitBadge;
const ROUTE_STOP_LABEL_FALLBACK = routeTaxonomy.routeStopLabels.fallback;
const ROUTE_STOP_LABEL_VALUES = Object.freeze([...routeTaxonomy.routeStopLabels.canonical]);
const RESERVED_ROUTE_STOP_LABEL_VALUES = Object.freeze([...routeTaxonomy.routeStopLabels.reserved]);
const PLACE_CATEGORY = Object.freeze({ ...routeTaxonomy.placeCategory });
const PLACE_CATEGORY_VALUES = Object.freeze(Object.values(PLACE_CATEGORY));
const THEME_CATEGORY = Object.freeze({ ...routeTaxonomy.themeCategory });
const THEME_CATEGORY_VALUES = Object.freeze(Object.values(THEME_CATEGORY));

function buildCanonicalRouteStopLabel(index, total) {
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
    return ["LUNCH", "VISIT", "DINNER"][index] || ROUTE_STOP_LABEL_FALLBACK;
  }

  if (total === 4) {
    return ["MORNING", "LUNCH", "VISIT", "DINNER"][index] || ROUTE_STOP_LABEL_FALLBACK;
  }

  if (total === 5) {
    return ["MORNING", "LUNCH", "VISIT", "DESSERT", "DINNER"][index] || ROUTE_STOP_LABEL_FALLBACK;
  }

  const labels = ["MORNING", "LUNCH"];
  const middleVisitCount = Math.max(0, total - 5);

  for (let visitIndex = 0; visitIndex < middleVisitCount; visitIndex += 1) {
    labels.push("VISIT");
  }

  labels.push("DESSERT", "DINNER", "NIGHT");
  return labels[index] || ROUTE_STOP_LABEL_FALLBACK;
}

function appendMustVisitBadge(badges, mustVisit) {
  const merged = new Set(
    (Array.isArray(badges) ? badges : [])
      .map((badge) => String(badge || "").trim().toUpperCase())
      .filter(Boolean)
  );

  if (mustVisit) {
    merged.add(MUST_VISIT_BADGE);
  }

  return [...merged];
}

module.exports = {
  MUST_VISIT_BADGE,
  ROUTE_STOP_LABEL_FALLBACK,
  ROUTE_STOP_LABEL_VALUES,
  RESERVED_ROUTE_STOP_LABEL_VALUES,
  PLACE_CATEGORY,
  PLACE_CATEGORY_VALUES,
  THEME_CATEGORY,
  THEME_CATEGORY_VALUES,
  buildCanonicalRouteStopLabel,
  appendMustVisitBadge
};
