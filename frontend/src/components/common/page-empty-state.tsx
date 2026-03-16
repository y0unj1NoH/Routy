import type { ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import type { MascotVariant } from "@/components/layout/mascot";
import { BADGE_HEIGHT_CLASS, BADGE_TEXT_CLASS } from "@/lib/badge-size";
import { cn } from "@/lib/cn";

type PageEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  mascotVariant?: MascotVariant;
  mascotSize?: "default" | "featured";
  mascotMotion?: "static" | "floating";
  mascotClassName?: string;
  showMascot?: boolean;
  previewLabel?: string;
  className?: string;
};

export function PageEmptyState({
  title,
  description,
  action,
  mascotVariant = "airplane",
  mascotSize = "default",
  mascotMotion = "static",
  mascotClassName,
  showMascot = true,
  previewLabel,
  className
}: PageEmptyStateProps) {
  return (
    <EmptyState
      variant="page"
      mascotVariant={mascotVariant}
      mascotSize={mascotSize}
      mascotMotion={mascotMotion}
      mascotClassName={mascotClassName}
      showMascot={showMascot}
      title={title}
      description={description}
      className={className}
      eyebrow={
        previewLabel ? (
          <p
            className={cn(
              "inline-flex items-center rounded-full border border-border bg-card/92 px-3 font-bold uppercase tracking-[0.14em] text-foreground/60",
              BADGE_HEIGHT_CLASS.small,
              BADGE_TEXT_CLASS.label
            )}
          >
            {previewLabel}
          </p>
        ) : null
      }
      action={action}
    />
  );
}
