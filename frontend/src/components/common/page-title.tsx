import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type PageTitleProps = {
  title: string;
  subtitle?: ReactNode;
  className?: string;
};

export function PageTitle({ title, subtitle, className }: PageTitleProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <h1 className="text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
      {subtitle ? <p className="text-sm text-foreground/65 md:text-base">{subtitle}</p> : null}
    </div>
  );
}

