import { Children, isValidElement, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { resolveBadgeColor } from "@/lib/badge-theme";
import { BADGE_HEIGHT_CLASS, BADGE_TEXT_CLASS } from "@/lib/badge-size";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
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

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  const badgeColor = resolveBadgeColor(extractTextContent(props.children));

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 font-semibold",
        BADGE_HEIGHT_CLASS.small,
        BADGE_TEXT_CLASS.small,
        badgeColor
          ? "border-transparent text-white shadow-[0_8px_16px_rgba(15,23,42,0.12)]"
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
