import type { ReactNode } from "react";

import { Mascot, MASCOT_SIZE_CLASS, type MascotVariant } from "@/components/layout/mascot";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  mascotVariant?: MascotVariant;
  variant?: "panel" | "page";
  mascotSize?: "default" | "featured";
  mascotMotion?: "static" | "floating";
  mascotClassName?: string;
  showMascot?: boolean;
  eyebrow?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  actionClassName?: string;
};

export function EmptyState({
  title,
  description,
  action,
  mascotVariant = "detective",
  variant = "panel",
  mascotSize,
  mascotMotion,
  mascotClassName,
  showMascot = true,
  eyebrow,
  className,
  titleClassName,
  descriptionClassName,
  actionClassName
}: EmptyStateProps) {
  const isPage = variant === "page";
  const resolvedMascotSize = mascotSize ?? "default";
  const resolvedMascotMotion = mascotMotion ?? "static";

  return (
    <section
      className={cn(
        isPage
          ? "flex max-w-md flex-col items-center gap-5 px-6 text-center"
          : "rounded-[28px] border border-dashed border-border-strong bg-card/90 px-6 py-12 text-center shadow-soft",
        className
      )}
    >
      {eyebrow ? <div>{eyebrow}</div> : null}
      {showMascot ? (
        isPage ? (
          <Mascot
            variant={mascotVariant}
            floating={resolvedMascotMotion === "floating"}
            priority={resolvedMascotSize === "featured"}
            className={cn(
              resolvedMascotSize === "featured" ? MASCOT_SIZE_CLASS.featuredPage : MASCOT_SIZE_CLASS.compact,
              mascotClassName
            )}
          />
        ) : (
          <div className="mb-5 flex justify-center">
            <Mascot variant={mascotVariant} className={cn(MASCOT_SIZE_CLASS.compact, mascotClassName)} />
          </div>
        )
      ) : null}
      <div className={cn(isPage && "space-y-2")}>
        <h2 className={cn(isPage ? "text-2xl font-black leading-tight md:text-3xl" : "text-xl font-bold", titleClassName)}>
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              isPage ? "text-sm font-semibold text-foreground/65 md:text-base" : "mx-auto mt-2 max-w-lg text-sm text-foreground/65",
              descriptionClassName
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className={cn(!isPage && "mt-6", actionClassName)}>{action}</div> : null}
    </section>
  );
}
