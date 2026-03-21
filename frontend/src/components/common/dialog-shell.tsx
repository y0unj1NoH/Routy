"use client";

import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

import { Mascot, type MascotVariant } from "@/components/layout/mascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type DialogShellProps = {
  open: boolean;
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  mascotVariant?: MascotVariant | null;
  mascotClassName?: string;
  size?: "md" | "lg";
  tone?: "default" | "danger";
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  showCloseButton?: boolean;
  onClose: () => void;
};

type DialogPanelProps = Omit<DialogShellProps, "open"> & {
  withModalA11y?: boolean;
};

const sizeClasses = {
  md: "max-w-[34rem]",
  lg: "max-w-[42rem]"
} as const;

function DialogPanel({
  eyebrow,
  title,
  description,
  children,
  footer,
  busy = false,
  mascotVariant = "detective",
  mascotClassName,
  size = "md",
  tone = "default",
  className,
  contentClassName,
  headerClassName,
  showCloseButton = false,
  withModalA11y = false,
  onClose
}: DialogPanelProps) {
  const titleId = useId();
  const descriptionId = useId();

  const modalA11yProps = withModalA11y
    ? {
        role: "dialog" as const,
        "aria-modal": true,
        "aria-labelledby": titleId,
        "aria-describedby": description ? descriptionId : undefined
      }
    : undefined;

  return (
    <Card
      {...modalA11yProps}
      className={cn(
        "flex w-full max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-xl border-border bg-white/98 p-0 shadow-floating backdrop-blur-none md:max-h-[calc(100dvh-3rem)] md:rounded-2xl",
        sizeClasses[size],
        className
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className={cn(
          "relative overflow-hidden border-b px-4 py-4 md:px-5 md:py-5",
          tone === "danger"
            ? "border-danger/18 bg-[linear-gradient(135deg,rgba(255,239,242,0.98),rgba(255,255,255,1)_74%)]"
            : "border-border/80 bg-linear-to-br from-primary-soft via-white to-card",
          headerClassName
        )}
      >
        <div
          className={cn(
            "absolute -right-10 -top-10 h-24 w-24 rounded-full blur-3xl",
            tone === "danger" ? "bg-danger/12" : "bg-primary/10"
          )}
        />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            {eyebrow ? (
              <div
                className={cn(
                  "font-black uppercase tracking-[0.16em] leading-none",
                  tone === "danger" ? "text-danger" : "text-primary/82"
                )}
                style={{ fontSize: "var(--page-eyebrow-size)" }}
              >
                {eyebrow}
              </div>
            ) : null}
            <h2
              id={titleId}
              className="break-keep font-black leading-[1.2] tracking-tight text-foreground"
              style={{ fontSize: "var(--modal-title-size)" }}
            >
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className="break-keep text-xs leading-5 text-foreground/60 md:text-sm">
                {description}
              </div>
            ) : null}
          </div>

          <div className="flex items-start gap-2">
            {mascotVariant ? (
              <Mascot
                variant={mascotVariant}
                className={cn("h-[var(--mascot-dialog-size)] w-[var(--mascot-dialog-size)] shrink-0 opacity-95", mascotClassName)}
              />
            ) : null}
            {showCloseButton ? (
              <Button
                variant="ghost"
                size="small"
                iconOnly
                className="text-foreground/52 hover:text-foreground"
                onClick={onClose}
                disabled={busy}
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className={cn("min-h-0 flex-1 space-y-[var(--modal-section-gap)] overflow-y-auto p-4 md:p-5", contentClassName)}>
          {children}
        </div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/70 px-4 py-3 md:px-5 sm:flex-nowrap">
            {footer}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function DialogShellPreview({
  className,
  ...props
}: Omit<DialogShellProps, "open">) {
  return (
    <div className="rounded-xl border border-border/70 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(233,240,248,0.96))] p-3 shadow-subtle md:rounded-2xl md:p-4">
      <div className="flex min-h-[160px] items-center justify-center">
        <DialogPanel {...props} className={className} />
      </div>
    </div>
  );
}

export function DialogShell({
  open,
  ...props
}: DialogShellProps) {
  const { busy = false, onClose } = props;

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgb(88_94_104/0.46)] px-3 py-4 backdrop-blur-[2px] md:px-4 md:py-6"
      onClick={() => {
        if (busy) return;
        onClose();
      }}
    >
      <DialogPanel {...props} withModalA11y />
    </div>
  );
}

