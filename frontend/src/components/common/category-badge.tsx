import type { CSSProperties, HTMLAttributes } from "react";

import { Badge } from "@/components/ui/badge";
import { BADGE_BASE_CLASS, BADGE_SIZE_CLASS_MAP, type BadgeSize } from "@/lib/badge-size";
import { cn } from "@/lib/cn";
import { resolveCategoryBadgeTheme } from "@/lib/badge-theme";

type CategoryBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  fallbackTone?: "default" | "primary";
  size?: BadgeSize;
  value: string | null | undefined;
};

export function CategoryBadge({
  className,
  fallbackTone = "default",
  size = "compact",
  style,
  value,
  ...props
}: CategoryBadgeProps) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return null;
  const fallbackLabel = rawValue.replace(/_/g, " ").replace(/\s+/g, " ").trim();

  const theme = resolveCategoryBadgeTheme(rawValue);

  if (!theme) {
    return (
      <Badge size={size} tone={fallbackTone} className={className} style={style} {...props}>
        {fallbackLabel}
      </Badge>
    );
  }

  const mergedStyle: CSSProperties = {
    borderColor: theme.border,
    backgroundColor: theme.bg,
    color: theme.text,
    ...style
  };

    return (
      <span
        className={cn(
          BADGE_BASE_CLASS,
          BADGE_SIZE_CLASS_MAP[size],
          className
        )}
        style={mergedStyle}
      {...props}
    >
      {theme.label}
    </span>
  );
}
