export const BADGE_HEIGHT_CLASS = {
  small: "min-h-7 md:min-h-8",
  medium: "min-h-8 md:min-h-10"
} as const;

export const BADGE_TEXT_CLASS = {
  xxs: "text-3xs leading-none md:text-2xs",
  small: "text-xs leading-none",
  label: "text-2xs leading-none md:text-xs",
  medium: "text-xs leading-none md:text-sm"
} as const;

export const BADGE_BASE_CLASS = "inline-flex items-center rounded-full border";

export const BADGE_SIZE_CLASS_MAP = {
  compact: "min-h-6 px-2 py-0.5 font-bold tracking-[0.06em] text-3xs leading-none md:min-h-7 md:px-2.5 md:py-1 md:text-2xs",
  default: "min-h-7 px-2.5 py-1 font-semibold text-xs leading-none md:min-h-8 md:px-3 md:py-1.5",
  card: "min-h-7 gap-1 px-2.5 py-1 text-[10px] font-black leading-none tracking-[0.08em] md:min-h-8 md:px-3 md:py-1.5 md:text-[11px]",
  prominent: "min-h-7 gap-1 px-3 py-1 text-[10px] font-black leading-none tracking-[0.08em] md:min-h-8 md:px-3.5 md:py-1.5 md:text-[11px]"
} as const;

export type BadgeSize = keyof typeof BADGE_SIZE_CLASS_MAP;
