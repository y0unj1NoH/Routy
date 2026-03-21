"use client";

import { ROUTE_VIEW_MODE_OPTIONS, type RouteViewMode } from "@/components/routes/route-view-mode";
import { buttonVariantToneClasses } from "@/components/ui/button-styles";
import { cn } from "@/lib/cn";

type RouteViewModeToggleProps = {
  value: RouteViewMode;
  onChange: (value: RouteViewMode) => void;
  splitLabel: string;
  listLabel: string;
  className?: string;
};

export function RouteViewModeToggle({
  value,
  onChange,
  splitLabel,
  listLabel,
  className
}: RouteViewModeToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center overflow-hidden rounded-md border border-border/80 bg-card/92 shadow-subtle backdrop-blur-[6px] md:min-h-10 md:rounded-lg",
        className
      )}
    >
      {ROUTE_VIEW_MODE_OPTIONS.map((option) => {
        const active = value === option.value;
        const label = option.labelKey === "splitLabel" ? splitLabel : listLabel;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-full min-w-24 items-center justify-center whitespace-nowrap px-3 text-xs font-bold leading-none transition-[background-color,color,box-shadow] md:px-4 md:text-sm",
              active
                ? `${buttonVariantToneClasses.primary} shadow-subtle`
                : "bg-transparent text-foreground/68 hover:bg-primary-soft/78"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
