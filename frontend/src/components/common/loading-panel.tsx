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
    <section className="fixed inset-0 z-50 flex min-h-dvh w-screen items-center justify-center bg-background/92 px-6 backdrop-blur-md">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="relative flex h-52 w-52 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-[6px] border-primary-light/20 border-t-primary" />
          <div className="absolute inset-[18px] rounded-full border border-border-strong/70 bg-card/88 shadow-soft" />
          {withMascot ? <Mascot variant={mascotVariant} className="relative z-10 h-32 w-32" priority /> : null}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-primary/70">loading</p>
          <div className="space-y-1.5">
            <p className="max-w-sm text-sm font-semibold text-foreground/72 sm:text-base">{message}</p>
            {detail ? <p className="max-w-md text-sm leading-6 text-foreground/56">{detail}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
