import type { CSSProperties } from "react";

import { BadgeIcon } from "@/components/common/badge-icon";
import type { BadgeIconName } from "@/lib/badge-theme";
import { BADGE_HEIGHT_CLASS, BADGE_TEXT_CLASS } from "@/lib/badge-size";
import { cn } from "@/lib/cn";

type PreferenceBadgeChipProps = {
  bg: string;
  className?: string;
  icon: BadgeIconName;
  label: string;
  text: string;
};

export function PreferenceBadgeChip({ bg, className, icon, label, text }: PreferenceBadgeChipProps) {
  const style: CSSProperties = {
    backgroundColor: bg,
    color: text
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-transparent px-4 font-semibold shadow-[0_10px_22px_rgba(56,123,194,0.12)]",
        BADGE_HEIGHT_CLASS.medium,
        BADGE_TEXT_CLASS.medium,
        className
      )}
      style={style}
    >
      <BadgeIcon name={icon} className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}
