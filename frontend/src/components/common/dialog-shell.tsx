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
  size?: "md" | "lg";
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
  md: "max-w-lg",
  lg: "max-w-2xl"
} as const;

function DialogPanel({
  eyebrow,
  title,
  description,
  children,
  footer,
  busy = false,
  mascotVariant = "detective",
  size = "md",
  className,
  contentClassName,
  headerClassName,
  showCloseButton = true,
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
        "w-full overflow-hidden border-border bg-white p-0 shadow-[0_28px_72px_rgba(31,41,55,0.24)] backdrop-blur-none",
        sizeClasses[size],
        className
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className={cn(
          "relative overflow-hidden border-b border-border/80 bg-linear-to-br from-primary-soft via-white to-card px-5 py-5 sm:px-6",
          headerClassName
        )}
      >
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            {eyebrow ? <div className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{eyebrow}</div> : null}
            <h2 id={titleId} className="text-xl font-black tracking-tight text-foreground sm:text-[1.7rem] sm:leading-[1.08] sm:tracking-[-0.03em]">
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className="text-sm leading-6 text-foreground/68">
                {description}
              </div>
            ) : null}
          </div>

          <div className="flex items-start gap-2">
            {mascotVariant ? <Mascot variant={mascotVariant} className="h-16 w-16 shrink-0 opacity-95 sm:h-20 sm:w-20" /> : null}
            {showCloseButton ? (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
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

      <div className={cn("space-y-5 p-5 sm:p-6", contentClassName)}>
        {children}
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-4">{footer}</div> : null}
      </div>
    </Card>
  );
}

export function DialogShellPreview({
  className,
  ...props
}: Omit<DialogShellProps, "open">) {
  return (
    <div className="rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(233,240,248,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:p-6">
      <div className="flex min-h-[180px] items-center justify-center">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(88_94_104/0.46)] px-4 py-6 backdrop-blur-[2px]"
      onClick={() => {
        if (busy) return;
        onClose();
      }}
    >
      <DialogPanel {...props} withModalA11y />
    </div>
  );
}
