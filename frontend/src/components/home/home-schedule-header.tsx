import { PageTitle } from "@/components/common/page-title";
import { Mascot } from "@/components/layout/mascot";
import { UI_COPY } from "@/constants/ui-copy";
import { cn } from "@/lib/cn";

type HomeScheduleHeaderProps = {
  showMascot?: boolean;
  className?: string;
};

export function HomeScheduleHeader({ showMascot = true, className }: HomeScheduleHeaderProps) {
  return (
    <section className={cn("relative overflow-visible", showMascot ? "pr-20 md:pr-26" : "", className)}>
      <PageTitle title={UI_COPY.home.header.title} subtitle={UI_COPY.home.header.subtitle} />
      {showMascot ? (
        <div className="pointer-events-none absolute right-0 top-1/2 flex items-center -translate-y-[56%]">
          {showMascot ? <Mascot floating priority className="h-[var(--mascot-compact-size)] w-[var(--mascot-compact-size)] shrink-0" /> : null}
        </div>
      ) : null}
    </section>
  );
}
