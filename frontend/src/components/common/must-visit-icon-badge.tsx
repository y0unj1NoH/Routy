import { Star } from "lucide-react";
import type { HTMLAttributes } from "react";

import { MUST_VISIT_BADGE } from "@/constants/route-taxonomy";
import { BADGE_COLOR_MAP, BADGE_TEXT_COLOR } from "@/lib/badge-theme";
import { cn } from "@/lib/cn";

const MUST_VISIT_ICON_SIZE_CLASS_MAP = {
  compact: "h-5 w-5 md:h-6 md:w-6 [&_svg]:h-2.5 [&_svg]:w-2.5 md:[&_svg]:h-3 md:[&_svg]:w-3",
  card: "h-6 w-6 md:h-7 md:w-7 [&_svg]:h-3 [&_svg]:w-3 md:[&_svg]:h-3.5 md:[&_svg]:w-3.5",
  prominent: "h-7 w-7 md:h-8 md:w-8 [&_svg]:h-3.5 [&_svg]:w-3.5 md:[&_svg]:h-4 md:[&_svg]:w-4"
} as const;

type MustVisitIconBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  label?: string;
  size?: keyof typeof MUST_VISIT_ICON_SIZE_CLASS_MAP;
};

export function MustVisitIconBadge({
  className,
  label = "Must Visit",
  size = "card",
  style,
  ...props
}: MustVisitIconBadgeProps) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-transparent shadow-subtle",
        MUST_VISIT_ICON_SIZE_CLASS_MAP[size],
        className
      )}
      style={{ backgroundColor: BADGE_COLOR_MAP[MUST_VISIT_BADGE], color: BADGE_TEXT_COLOR, ...style }}
      {...props}
    >
      <Star aria-hidden="true" fill="currentColor" />
    </span>
  );
}
