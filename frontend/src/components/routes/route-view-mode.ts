export type RouteViewMode = "split" | "list";
export type RouteViewModeLabelKey = "splitLabel" | "listLabel";

export const ROUTE_VIEW_MODE_OPTIONS: { value: RouteViewMode; labelKey: RouteViewModeLabelKey }[] = [
  { value: "split", labelKey: "splitLabel" },
  { value: "list", labelKey: "listLabel" }
];
