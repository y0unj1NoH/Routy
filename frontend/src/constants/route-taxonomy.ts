import routeTaxonomy from "../../../shared/route-taxonomy.json";

export type MustVisitBadgeValue = "MUSTVISIT";
export type CanonicalRouteStopLabel = "MORNING" | "LUNCH" | "VISIT" | "DESSERT" | "DINNER" | "NIGHT";
export type ReservedRouteStopLabel = never;
export type LegacyRouteStopLabel = "START" | "FINISH";
export type RouteStopLabelValue = CanonicalRouteStopLabel | LegacyRouteStopLabel;
export type PlaceCategoryValue =
  | "STAY"
  | "MEAL"
  | "BRUNCH"
  | "CAFE"
  | "SNACK"
  | "NIGHT"
  | "ACTIVITY"
  | "LANDMARK"
  | "NATURE"
  | "SHOP";
export type ThemeValue = "FOODIE" | "LANDMARK" | "SHOPPING" | "NATURE";

export const MUST_VISIT_BADGE = routeTaxonomy.mustVisitBadge as MustVisitBadgeValue;
export const ROUTE_STOP_LABEL_FALLBACK = routeTaxonomy.routeStopLabels.fallback as CanonicalRouteStopLabel;
export const ROUTE_STOP_LABEL_VALUES = [...routeTaxonomy.routeStopLabels.canonical] as CanonicalRouteStopLabel[];
export const RESERVED_ROUTE_STOP_LABEL_VALUES = [...routeTaxonomy.routeStopLabels.reserved] as ReservedRouteStopLabel[];
export const PLACE_CATEGORY = routeTaxonomy.placeCategory as Record<PlaceCategoryValue, PlaceCategoryValue>;
export const PLACE_CATEGORY_VALUES = Object.values(PLACE_CATEGORY);
export const THEME_CATEGORY = routeTaxonomy.themeCategory as Record<ThemeValue, ThemeValue>;
export const THEME_CATEGORY_VALUES = Object.values(THEME_CATEGORY);
