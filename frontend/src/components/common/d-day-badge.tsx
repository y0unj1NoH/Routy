import { DDAY_BADGE_STYLE } from "@/lib/badge-theme";

type DDayBadgeProps = {
  label: string;
};

export function DDayBadge({ label }: DDayBadgeProps) {
  return (
    <span
      className="inline-flex min-h-8 min-w-[3.6rem] items-center justify-center rounded-full border border-white/55 px-3 text-[11px] font-black leading-none tracking-[-0.02em] tabular-nums text-white shadow-[0_10px_22px_rgba(60,157,255,0.22)] md:min-h-9 md:min-w-[4rem] md:px-3.5 md:text-xs"
      style={{ backgroundColor: DDAY_BADGE_STYLE.bg, color: DDAY_BADGE_STYLE.text }}
    >
      {label}
    </span>
  );
}
