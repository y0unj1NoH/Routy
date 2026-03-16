import type { CSSProperties, HTMLAttributes } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { resolveCategoryBadgeTheme } from "@/lib/badge-theme";

type CategoryBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  fallbackTone?: "default" | "primary";
  value: string | null | undefined;
};

export function CategoryBadge({
  className,
  fallbackTone = "default",
  style,
  value,
  ...props
}: CategoryBadgeProps) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return null;

  const theme = resolveCategoryBadgeTheme(rawValue);

  if (!theme) {
    return (
      <Badge tone={fallbackTone} className={className} style={style} {...props}>
        {rawValue}
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.08em]",
        className
      )}
      style={mergedStyle}
      {...props}
    >
      {theme.label}
    </span>
  );
}
