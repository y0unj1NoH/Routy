"use client";

import { HorizontalDragScroll } from "@/components/common/horizontal-drag-scroll";
import { buttonVariantToneClasses } from "@/components/ui/button-styles";
import { formatDateLabel } from "@/lib/format";
import type { ScheduleDay } from "@/types/domain";

type RouteDaySelectorProps = {
  currentDayDate?: string | null;
  currentDayNumber?: number | null;
  days: ScheduleDay[];
  onSelectDay: (dayNumber: number) => void;
};

export function RouteDaySelector({ currentDayDate, currentDayNumber, days, onSelectDay }: RouteDaySelectorProps) {
  return (
    <section className="min-w-0 shrink-0 overflow-hidden rounded-2xl border border-border bg-card/82 p-3 shadow-[0_12px_28px_rgba(56,123,194,0.08)]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-black">
          day {currentDayNumber || 1} <span className="font-medium text-foreground/60">{formatDateLabel(currentDayDate)}</span>
        </p>
      </div>
      <HorizontalDragScroll
        className="w-full snap-x snap-mandatory touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain px-1 pb-1 scrollbar-hidden"
        innerClassName="flex min-w-max gap-2"
      >
        {days.map((day) => (
          <button
            key={day.id}
            type="button"
            onClick={() => onSelectDay(day.dayNumber)}
            className={`shrink-0 snap-start whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold ${
              currentDayNumber === day.dayNumber
                ? `border-primary ${buttonVariantToneClasses.primary} shadow-[0_8px_18px_rgba(56,123,194,0.12)]`
                : "border-border bg-card text-foreground/70"
            }`}
          >
            day {day.dayNumber}
          </button>
        ))}
      </HorizontalDragScroll>
    </section>
  );
}
