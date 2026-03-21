import Link from "next/link";

import { Card } from "@/components/ui/card";
import { BADGE_HEIGHT_CLASS, BADGE_TEXT_CLASS } from "@/lib/badge-size";
import { cn } from "@/lib/cn";

type NextTripCardProps = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  className?: string;
};

export function NextTripCard({ href, eyebrow, title, description, statusLabel, className }: NextTripCardProps) {
  return (
    <Link href={href} className={cn("group block focus-visible:outline-none", className)}>
      <Card className="overflow-hidden border-primary-light bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,251,255,0.96))] p-4 transition-[transform,box-shadow,border-color,background-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary-light/90 group-hover:shadow-surface group-focus-visible:-translate-y-0.5 group-focus-visible:border-primary-light/90 group-focus-visible:shadow-surface md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 transition-colors duration-200 group-hover:text-primary group-focus-visible:text-primary md:mb-2 md:text-[11px]">
              {eyebrow}
            </p>
            <div className="space-y-0.5">
              <h2
                className="font-black leading-[1.08] tracking-[-0.03em] text-foreground transition-colors duration-200 group-hover:text-primary-hover group-focus-visible:text-primary-hover"
                style={{ fontSize: "var(--page-empty-title-size)" }}
              >
                {title}
              </h2>
              <p className="pl-0.5 text-[11px] text-foreground/68 sm:text-[12px] md:pl-1 md:text-sm">{description}</p>
            </div>
          </div>
          <div
            className={cn(
              "mt-0.5 inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-border/80 bg-card/92 px-2.5 font-bold text-primary shadow-subtle transition-[transform,box-shadow,border-color,background-color] duration-200 group-hover:-translate-y-px group-hover:border-primary-light/70 group-hover:bg-white group-hover:shadow-[0_10px_22px_rgba(60,157,255,0.12)] group-focus-visible:-translate-y-px group-focus-visible:border-primary-light/70 group-focus-visible:bg-white group-focus-visible:shadow-[0_10px_22px_rgba(60,157,255,0.12)] md:px-3",
              BADGE_HEIGHT_CLASS.small,
              BADGE_TEXT_CLASS.label
            )}
          >
            {statusLabel}
          </div>
        </div>
      </Card>
    </Link>
  );
}
