"use client";

import type { ReactNode } from "react";

import { RouteDayEmptyState } from "@/components/routes/route-day-empty-state";
import { RouteTravelIcon } from "@/components/routes/route-travel-icon";
import { UI_COPY } from "@/constants/ui-copy";
import { cn } from "@/lib/cn";
import { inferRouteTravelInfo } from "@/lib/route-travel";
import type { ScheduleDay, ScheduleStop } from "@/types/domain";
import type { RouteStopListRefs } from "@/hooks/use-route-stop-interactions";

type RouteStopListProps = {
  activeStopId: string | null;
  className?: string;
  day: ScheduleDay | null;
  refs: RouteStopListRefs;
  renderStopCard: (stop: ScheduleStop, isActive: boolean) => ReactNode;
  topContent?: ReactNode;
};

export function RouteStopList({
  activeStopId,
  className,
  day,
  refs,
  renderStopCard,
  topContent
}: RouteStopListProps) {
  const stops = day?.stops || [];

  return (
    <section
      ref={refs.scrollRef}
      className={cn("flex min-h-[280px] flex-col rounded-lg bg-primary-soft/55 p-2.5 md:rounded-2xl md:bg-primary-soft/80 md:p-4", className)}
    >
      {topContent ? <div className="shrink-0 pb-2.5 md:pb-3">{topContent}</div> : null}
      {stops.length === 0 ? (
        <RouteDayEmptyState />
      ) : (
        <div className="flex flex-col gap-4 pb-4">
          {stops.map((stop, index) => {
            const travelInfo = inferRouteTravelInfo(stop, stops[index + 1]);
            const isActive = activeStopId === stop.id;

            return (
              <div
                key={stop.id}
                ref={(node) => {
                  refs.itemRefs.current[stop.id] = node;
                }}
                className="grid scroll-mt-3 grid-cols-[44px_1fr] gap-2.5 md:grid-cols-[56px_1fr] md:gap-3"
              >
                <div className="relative flex flex-col items-center">
                  <div
                    className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white shadow-subtle md:h-11 md:w-11 md:text-sm ${
                      isActive ? "bg-primary" : "bg-primary-light"
                    }`}
                  >
                    {stop.stopOrder}
                  </div>
                  {index < stops.length - 1 ? <div className="mt-1 h-full min-h-10 w-[2px] bg-border-strong" /> : null}
                  {travelInfo ? (
                    <div className="mt-1.5 rounded-full border border-border-strong bg-card/92 px-1.5 py-0.5 text-2xs font-bold text-foreground/65 shadow-subtle md:mt-2 md:px-2 md:py-1 md:text-xs">
                      {travelInfo.distanceLabel}
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0 space-y-2">
                  {renderStopCard(stop, isActive)}

                  {travelInfo ? (
                    <div className="flex items-center gap-2 px-1 pt-2 text-xs font-semibold text-foreground/70">
                      <RouteTravelIcon kind={travelInfo.icon} />
                      <span>{UI_COPY.routes.detail.travelToNext(travelInfo.modeLabel, travelInfo.durationLabel)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
