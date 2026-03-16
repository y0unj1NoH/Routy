"use client";

import { ROUTE_VIEW_MODE_OPTIONS, type RouteViewMode } from "@/components/routes/route-view-mode";
import { cn } from "@/lib/cn";

type RouteViewModeSliderToggleProps = {
  value: RouteViewMode;
  onChange: (value: RouteViewMode) => void;
  splitLabel: string;
  listLabel: string;
  className?: string;
};

const SEGMENT_WIDTH = "5.75rem";

export function RouteViewModeSliderToggle({
  value,
  onChange,
  splitLabel,
  listLabel,
  className
}: RouteViewModeSliderToggleProps) {
  const activeIndex = value === "list" ? 1 : 0;

  return (
    <div
      style={{ ["--route-view-toggle-segment-width" as string]: SEGMENT_WIDTH }}
      className={cn(
        "relative inline-flex h-9 shrink-0 items-center overflow-hidden rounded-md bg-card/94 p-1 shadow-[inset_0_0_0_1px_rgba(184,200,222,0.9),0_6px_14px_rgba(56,123,194,0.07)] backdrop-blur-[6px]",
        className
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1 top-1 h-7 w-[var(--route-view-toggle-segment-width)] rounded-[8px] bg-primary shadow-[0_7px_16px_rgba(56,123,194,0.18)] transition-transform duration-250 ease-out will-change-transform",
          activeIndex === 1 && "translate-x-[var(--route-view-toggle-segment-width)]"
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
            className={cn(
              "relative z-10 inline-flex h-7 w-[var(--route-view-toggle-segment-width)] items-center justify-center whitespace-nowrap rounded-[8px] px-3 text-[13px] font-bold leading-none tracking-[-0.01em] transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/20",
              active ? "text-white" : "text-foreground/68 hover:text-foreground/82"
            )}
          >
            <span className="text-current">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
