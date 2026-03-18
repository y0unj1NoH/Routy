"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

type SelectableOptionCardProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
  className?: string;
};

export function SelectableOptionCard({
  title,
  description,
  icon: Icon,
  active,
  onClick,
  className
}: SelectableOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group w-full rounded-xl border px-4 py-3.5 text-left shadow-surface transition-[background-color,border-color,box-shadow] focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-primary/12 md:rounded-2xl md:px-5 md:py-4",
        active
          ? "border-primary bg-primary/12 text-primary shadow-raised"
          : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-muted/60",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <span
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-subtle transition-colors md:h-10 md:w-10 md:rounded-xl",
              active
                ? "border-primary/18 bg-primary/12 text-primary"
                : "border-border/70 bg-muted/35 text-foreground/62 group-hover:bg-muted/55"
            )}
          >
            <Icon className="h-4 w-4 md:h-[18px] md:w-[18px]" aria-hidden="true" />
          </span>
        ) : null}
        <div className={cn("flex min-w-0 flex-col", description ? "gap-0.5" : "justify-center", !description && "min-h-[34px]")}>
          <p className="break-keep text-xs font-bold leading-[1.35] md:text-sm">{title}</p>
          {description ? <p className="break-keep text-2xs leading-[1.35] text-foreground/60 md:text-xs">{description}</p> : null}
        </div>
      </div>
    </button>
  );
}
