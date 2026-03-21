"use client";

import { HorizontalDragScroll } from "@/components/common/horizontal-drag-scroll";
import { buttonVariantToneClasses } from "@/components/ui/button-styles";
import { formatDateLabel } from "@/lib/format";
import type { ScheduleDay } from "@/types/domain";

type RouteDaySelectorProps = {
  compactMobile?: boolean;
  currentDayDate?: string | null;
  currentDayNumber?: number | null;
  days: ScheduleDay[];
  onSelectDay: (dayNumber: number) => void;
};

export function RouteDaySelector({
  compactMobile = false,
  currentDayDate,
  currentDayNumber,
  days,
  onSelectDay
}: RouteDaySelectorProps) {
  return (
    <section
      className={`w-full min-w-0 shrink-0 overflow-hidden rounded-xl border border-border bg-card/82 shadow-surface md:rounded-2xl md:p-4 ${
        compactMobile ? "p-2.5" : "p-3"
      }`}
    >
      <div className={`${compactMobile ? "mb-1.5" : "mb-2"} flex items-center justify-between`}>
        <p className={`${compactMobile ? "text-xs" : "text-sm"} font-black md:text-base`}>
          day {currentDayNumber || 1}{" "}
          <span className="font-normal text-foreground/60" style={{ fontSize: "var(--page-subtitle-size)" }}>
            {formatDateLabel(currentDayDate)}
          </span>
        </p>
      </div>
      <HorizontalDragScroll
        className="w-full snap-x snap-mandatory touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain px-1 pb-1 scrollbar-hidden"
        innerClassName={compactMobile ? "flex min-w-max gap-1.5" : "flex min-w-max gap-2"}
      >
        {days.map((day) => (
          <button
            key={day.id}
            type="button"
            onClick={() => onSelectDay(day.dayNumber)}
            className={`shrink-0 snap-start whitespace-nowrap rounded-full border font-bold ${
              compactMobile ? "min-h-8 px-3 py-1 text-[12px] md:min-h-10 md:px-4 md:py-2.5 md:text-[length:var(--pill-text-size)]" : "min-h-9 px-4 py-2 text-[length:var(--pill-text-size)] md:min-h-10 md:py-2.5"
            } ${
              currentDayNumber === day.dayNumber
                ? `border-primary ${buttonVariantToneClasses.primary} shadow-subtle`
                : "border-border bg-card text-foreground/70 shadow-subtle"
            }`}
          >
            day {day.dayNumber}
          </button>
        ))}
      </HorizontalDragScroll>
    </section>
  );
}
