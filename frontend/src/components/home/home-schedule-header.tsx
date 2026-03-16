import { PageTitle } from "@/components/common/page-title";
import { Mascot } from "@/components/layout/mascot";
import { UI_COPY } from "@/constants/ui-copy";
import { BADGE_HEIGHT_CLASS, BADGE_TEXT_CLASS } from "@/lib/badge-size";
import { cn } from "@/lib/cn";

type HomeScheduleHeaderProps = {
  statusLabel?: string;
  showMascot?: boolean;
  className?: string;
};

export function HomeScheduleHeader({ statusLabel, showMascot = true, className }: HomeScheduleHeaderProps) {
  const hasStatusLabel = Boolean(statusLabel);
  const hasAside = hasStatusLabel || showMascot;

  return (
    <section
      className={cn(
        "relative overflow-visible",
        hasStatusLabel ? "pr-58 sm:pr-66" : showMascot ? "pr-30 sm:pr-36" : "",
        className
      )}
    >
      <PageTitle title={UI_COPY.home.header.title} subtitle={UI_COPY.home.header.subtitle} />
      {hasAside ? (
        <div
          className={cn(
            "pointer-events-none absolute right-0 top-1/2 flex items-center -translate-y-[56%]",
            hasStatusLabel && showMascot && "gap-3 sm:gap-4"
          )}
        >
          {statusLabel ? (
            <p
              className={cn(
                "inline-flex shrink-0 items-center whitespace-nowrap rounded-[18px] border border-border bg-card/94 px-3 text-left font-bold text-foreground/72 shadow-soft sm:text-xs",
                BADGE_HEIGHT_CLASS.medium,
                BADGE_TEXT_CLASS.label
              )}
            >
              {statusLabel}
            </p>
          ) : null}
          {showMascot ? <Mascot floating priority className="h-24 w-24 shrink-0 sm:h-28 sm:w-28" /> : null}
        </div>
      ) : null}
    </section>
  );
}
