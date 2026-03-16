import type { HTMLAttributes } from "react";

import {
  ROUTE_STOP_LABEL_FALLBACK,
  type RouteStopLabelValue
} from "@/constants/route-taxonomy";
import { cn } from "@/lib/cn";

export const ROUTE_LABEL_STYLE_MAP = {
  START: "border-[#BFE2FF] bg-[#ECF7FF] text-[#2E78BE]",
  MORNING: "border-[#CBE5FF] bg-[#F1F8FF] text-[#3E8ED8]",
  VISIT: "border-[#D6DEFF] bg-[#F2F5FF] text-[#5479D3]",
  LUNCH: "border-[#FFE1B8] bg-[#FFF6E9] text-[#B97524]",
  FINISH: "border-[#D1EAD9] bg-[#F1FAF5] text-[#3A8A66]",
  DINNER: "border-[#E7D1DA] bg-[#FBF2F6] text-[#A44F6D]",
  DESSERT: "border-[#F7D6E8] bg-[#FFF3FA] text-[#C45A8A]",
  NIGHT: "border-[#DCCEFF] bg-[#F5F0FF] text-[#6C52C7]"
} as const satisfies Record<RouteStopLabelValue, string>;

export type RouteLabelValue = keyof typeof ROUTE_LABEL_STYLE_MAP;

export const ROUTE_LABEL_VALUES: RouteLabelValue[] = Object.keys(ROUTE_LABEL_STYLE_MAP) as RouteLabelValue[];

export function normalizeRouteLabel(value: string | null | undefined): RouteLabelValue {
  const normalizedValue = String(value || "")
    .trim()
    .toUpperCase();

  return normalizedValue in ROUTE_LABEL_STYLE_MAP ? (normalizedValue as RouteLabelValue) : ROUTE_STOP_LABEL_FALLBACK;
}

type RouteLabelChipProps = HTMLAttributes<HTMLSpanElement> & {
  value: string | null | undefined;
};

export function RouteLabelChip({ className, value, ...props }: RouteLabelChipProps) {
  const normalizedValue = normalizeRouteLabel(value);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.04em]",
        ROUTE_LABEL_STYLE_MAP[normalizedValue],
        className
      )}
      {...props}
    >
      {normalizedValue}
    </span>
  );
}
