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
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className={cn("text-lg font-black leading-tight md:text-xl", titleClassName)}>{title}</h2>
        {description ? (
          <p className={cn("text-sm leading-relaxed text-foreground/60", descriptionClassName)}>{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
