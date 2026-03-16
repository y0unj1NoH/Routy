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
        "inline-flex h-9 shrink-0 items-center overflow-hidden rounded-md bg-card/92 shadow-[inset_0_0_0_1px_rgba(184,200,222,0.9),0_6px_14px_rgba(56,123,194,0.07)] backdrop-blur-[6px]",
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
              "inline-flex h-full min-w-[5.75rem] items-center justify-center whitespace-nowrap px-3.5 text-sm font-bold leading-none transition-[background-color,color,box-shadow]",
              active
                ? `${buttonVariantToneClasses.primary} shadow-[0_4px_12px_rgba(56,123,194,0.14)]`
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
