import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn("w-full rounded-xl border border-border/80 bg-card/88 backdrop-blur-xs shadow-surface md:rounded-2xl", className)}
      {...props}
    />
  );
}
