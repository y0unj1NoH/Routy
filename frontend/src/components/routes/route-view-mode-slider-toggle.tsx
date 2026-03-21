"use client";

import { Map, Rows3 } from "lucide-react";

import { ROUTE_VIEW_MODE_OPTIONS, type RouteViewMode } from "@/components/routes/route-view-mode";
import { cn } from "@/lib/cn";

type RouteViewModeSliderToggleProps = {
  value: RouteViewMode;
  onChange: (value: RouteViewMode) => void;
  splitLabel: string;
  listLabel: string;
  className?: string;
  compactMobile?: boolean;
  iconOnly?: boolean;
};

const DEFAULT_SEGMENT_WIDTH = "4.75rem";
const COMPACT_MOBILE_SEGMENT_WIDTH = "4.25rem";
const ICON_ONLY_MOBILE_SEGMENT_WIDTH = "2.25rem";
const ICON_ONLY_DESKTOP_SEGMENT_WIDTH = "2.75rem";

export function RouteViewModeSliderToggle({
  compactMobile = false,
  iconOnly = false,
  value,
  onChange,
  splitLabel,
  listLabel,
  className
}: RouteViewModeSliderToggleProps) {
  const activeIndex = value === "list" ? 1 : 0;
  const mobileSegmentWidth = iconOnly
    ? ICON_ONLY_MOBILE_SEGMENT_WIDTH
    : compactMobile
      ? COMPACT_MOBILE_SEGMENT_WIDTH
      : DEFAULT_SEGMENT_WIDTH;
  const desktopSegmentWidth = iconOnly ? ICON_ONLY_DESKTOP_SEGMENT_WIDTH : DEFAULT_SEGMENT_WIDTH;

  return (
    <div
      style={{
        ["--route-view-toggle-mobile-segment-width" as string]: mobileSegmentWidth,
        ["--route-view-toggle-desktop-segment-width" as string]: desktopSegmentWidth
      }}
      className={cn(
        compactMobile
          ? "relative inline-flex min-h-9 shrink-0 items-center overflow-hidden rounded-md border border-border/80 bg-card/94 p-0.5 shadow-subtle backdrop-blur-[6px] md:min-h-10 md:p-1"
          : "relative inline-flex min-h-9 shrink-0 items-center overflow-hidden rounded-md border border-border/80 bg-card/94 p-0.5 shadow-subtle backdrop-blur-[6px] md:min-h-10 md:p-1",
        className
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          compactMobile
            ? "pointer-events-none absolute left-0.5 top-0.5 h-8 w-[var(--route-view-toggle-mobile-segment-width)] rounded-sm bg-primary shadow-thumb transition-transform duration-250 ease-out will-change-transform md:left-1 md:top-1 md:h-8 md:w-[var(--route-view-toggle-desktop-segment-width)]"
            : "pointer-events-none absolute left-0.5 top-0.5 h-8 w-[var(--route-view-toggle-mobile-segment-width)] rounded-sm bg-primary shadow-thumb transition-transform duration-250 ease-out will-change-transform md:left-1 md:top-1 md:h-8 md:w-[var(--route-view-toggle-desktop-segment-width)]",
          activeIndex === 1 &&
            (compactMobile
              ? "translate-x-[var(--route-view-toggle-mobile-segment-width)] md:translate-x-[var(--route-view-toggle-desktop-segment-width)]"
              : "translate-x-[var(--route-view-toggle-mobile-segment-width)] md:translate-x-[var(--route-view-toggle-desktop-segment-width)]")
        )}
      />

      {ROUTE_VIEW_MODE_OPTIONS.map((option) => {
        const active = value === option.value;
        const label = option.labelKey === "splitLabel" ? splitLabel : listLabel;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={cn(
              iconOnly
                ? "relative z-10 inline-flex min-h-8 w-[var(--route-view-toggle-mobile-segment-width)] items-center justify-center rounded-sm px-0 py-0 text-current transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/20 md:min-h-8 md:w-[var(--route-view-toggle-desktop-segment-width)] md:px-4 md:py-2"
                : compactMobile
                ? "relative z-10 inline-flex min-h-8 w-[var(--route-view-toggle-mobile-segment-width)] items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-1.5 font-bold leading-none tracking-[-0.01em] transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/20 md:min-h-8 md:w-[var(--route-view-toggle-desktop-segment-width)] md:px-4 md:py-2"
                : "relative z-10 inline-flex min-h-8 w-[var(--route-view-toggle-mobile-segment-width)] items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 font-bold leading-none tracking-[-0.01em] transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/20 md:w-[var(--route-view-toggle-desktop-segment-width)] md:px-4",
              active ? "text-white" : "text-foreground/68 hover:text-foreground/82"
            )}
          >
            {iconOnly ? (
              <span aria-hidden="true">
                {option.value === "split" ? (
                  <Map className="h-3.5 w-3.5 md:h-4 md:w-4" />
                ) : (
                  <Rows3 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                )}
              </span>
            ) : (
              <span
                className={cn(
                  "text-current",
                  compactMobile ? "text-[11px] md:text-[length:var(--pill-text-size)]" : "text-[length:var(--pill-text-size)]"
                )}
              >
                {label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
