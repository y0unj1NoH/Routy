import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type SectionHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export function SectionHeader({
  title,
  description,
  action,
  className,
  titleClassName,
  descriptionClassName
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 md:gap-4", className)}>
      <div className="min-w-0 flex-1 space-y-0.5">
        <h2
          className={cn("break-keep font-black leading-[1.2] text-foreground", titleClassName)}
          style={{ fontSize: "var(--section-title-size)" }}
        >
          {title}
        </h2>
        {description ? (
          <p className={cn("break-keep text-xs leading-relaxed text-foreground/60 md:text-sm", descriptionClassName)}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
