import { Children, isValidElement, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { resolveBadgeColor } from "@/lib/badge-theme";
import { BADGE_BASE_CLASS, BADGE_SIZE_CLASS_MAP, type BadgeSize } from "@/lib/badge-size";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  size?: BadgeSize;
  tone?: "default" | "primary";
};

function extractTextContent(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (isValidElement<{ children?: ReactNode }>(child)) {
        return extractTextContent(child.props.children);
      }
      return "";
    })
    .join("")
    .trim();
}

export function Badge({ className, size = "default", tone = "default", ...props }: BadgeProps) {
  const badgeColor = resolveBadgeColor(extractTextContent(props.children));

  return (
    <span
      className={cn(
        BADGE_BASE_CLASS,
        BADGE_SIZE_CLASS_MAP[size],
        badgeColor
          ? "border-transparent text-white shadow-subtle"
          : tone === "primary"
            ? "border-primary-light/45 bg-primary-soft text-primary-hover"
            : "border-border/70 bg-card/80 text-foreground/80",
        className
      )}
      style={badgeColor ? { backgroundColor: badgeColor } : undefined}
      {...props}
    />
  );
}
