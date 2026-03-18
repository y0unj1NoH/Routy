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
          ? "flex w-full max-w-sm flex-col items-center gap-4 px-4 text-center md:max-w-md md:gap-5 md:px-6 xl:max-w-lg xl:gap-6 xl:px-8"
          : "w-full rounded-xl border border-dashed border-border-strong bg-card/90 px-5 py-8 text-center shadow-surface md:rounded-2xl md:px-6 md:py-10",
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
              resolvedMascotSize === "featured" ? MASCOT_SIZE_CLASS.pageHero : MASCOT_SIZE_CLASS.emptyState,
              mascotClassName
            )}
          />
        ) : (
          <div className="mb-4 flex justify-center">
            <Mascot variant={mascotVariant} className={cn(MASCOT_SIZE_CLASS.emptyState, mascotClassName)} />
          </div>
        )
      ) : null}
      <div className={cn(isPage && "space-y-2 md:space-y-2.5")}>
        <h2
          className={cn(
            "font-black leading-[1.2]",
            titleClassName
          )}
          style={{ fontSize: isPage ? "var(--page-empty-title-size)" : "var(--card-title-size)" }}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              isPage
                ? "mx-auto max-w-sm text-xs leading-6 text-foreground/65 md:max-w-md md:text-sm md:leading-[1.7]"
                : "mx-auto mt-2 max-w-lg text-xs leading-6 text-foreground/65 md:text-sm",
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
