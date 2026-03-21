import { Mascot, type MascotVariant } from "@/components/layout/mascot";
import { UI_COPY } from "@/constants/ui-copy";

type LoadingPanelProps = {
  message?: string;
  detail?: string;
  withMascot?: boolean;
  mascotVariant?: MascotVariant;
};

export function LoadingPanel({
  message = UI_COPY.common.loading.default,
  detail,
  withMascot = true,
  mascotVariant = "detective"
}: LoadingPanelProps) {
  return (
    <section className="fixed inset-0 z-50 flex min-h-dvh w-screen items-center justify-center bg-background/92 px-4 backdrop-blur-md md:px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative flex h-40 w-40 items-center justify-center md:h-44 md:w-44">
          <div className="absolute inset-0 animate-spin rounded-full border-[5px] border-primary-light/20 border-t-primary" />
          <div className="absolute inset-[14px] rounded-full border border-border-strong/70 bg-card/88 shadow-surface md:inset-[16px]" />
          {withMascot ? <Mascot variant={mascotVariant} className="relative z-10 h-[var(--mascot-loading-size)] w-[var(--mascot-loading-size)]" priority /> : null}
        </div>
        <div className="space-y-1.5">
          <p className="text-2xs font-black uppercase tracking-[0.24em] text-primary/70 md:text-xs">loading</p>
          <div className="space-y-1.5">
            <p className="max-w-sm text-sm font-semibold text-foreground/72">{message}</p>
            {detail ? <p className="max-w-md whitespace-pre-line text-xs leading-6 text-foreground/56 md:text-sm">{detail}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
