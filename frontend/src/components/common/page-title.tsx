import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type PageTitleProps = {
  title: string;
  subtitle?: ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function PageTitle({ title, subtitle, className, titleClassName, subtitleClassName }: PageTitleProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <h1
        className={cn(
          "break-keep font-black leading-[1.2] tracking-[-0.03em] text-[length:var(--page-title-size)] text-foreground",
          titleClassName
        )}
      >
        {title}
      </h1>
      {subtitle ? (
        <p
          className={cn("break-keep text-[length:var(--page-subtitle-size)] leading-[1.5] text-foreground/65", subtitleClassName)}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
