"use client";

import { Mascot } from "@/components/layout/mascot";
import { UI_COPY } from "@/constants/ui-copy";
import { cn } from "@/lib/cn";

type RouteDayEmptyStateProps = {
  className?: string;
};

export function RouteDayEmptyState({ className }: RouteDayEmptyStateProps) {
  return (
    <div className={cn("flex min-h-[220px] flex-1 items-center justify-center", className)}>
      <div className="w-full rounded-xl border border-dashed border-border-strong/80 bg-background/82 px-5 py-7 text-center shadow-surface md:rounded-2xl">
        <div className="flex justify-center">
          <Mascot variant="detective" className="h-20 w-20" />
        </div>
        <p className="mt-4 text-xs font-semibold leading-6 text-foreground/72 md:text-sm">{UI_COPY.routes.detail.emptyDay}</p>
      </div>
    </div>
  );
}
