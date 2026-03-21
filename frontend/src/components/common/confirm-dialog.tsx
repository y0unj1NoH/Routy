"use client";

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { DialogShell } from "@/components/common/dialog-shell";
import type { MascotVariant } from "@/components/layout/mascot";
import { UI_COPY } from "@/constants/ui-copy";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  mascotVariant?: MascotVariant;
  busy?: boolean;
  intent?: "default" | "danger";
  footer?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  mascotVariant = "detective",
  busy = false,
  intent = "default",
  footer,
  onConfirm,
  onClose
}: ConfirmDialogProps) {
  if (!open) return null;

  const resolvedMascotVariant = intent === "danger" ? null : mascotVariant;
  const resolvedDescription = description || UI_COPY.common.deleteConfirm.description;
  const resolvedEyebrow = intent === "danger" ? "Delete Confirm" : undefined;
  const resolvedHeaderClassName =
    intent === "danger" ? undefined : "bg-[linear-gradient(135deg,rgba(232,244,255,0.94),rgba(255,255,255,1)_72%)]";

  return (
    <DialogShell
      open={open}
      eyebrow={resolvedEyebrow}
      title={title}
      description={undefined}
      busy={busy}
      mascotVariant={resolvedMascotVariant}
      tone={intent}
      headerClassName={resolvedHeaderClassName}
      showCloseButton={false}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="secondary"
            size="medium"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={intent === "danger" ? "danger" : "primary"}
            size="medium"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {resolvedDescription ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-danger/22 bg-danger/6 p-3.5 shadow-subtle md:rounded-xl md:p-4">
          <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
          <p className="break-keep text-xs leading-5 text-foreground/72 md:text-sm">{resolvedDescription}</p>
        </div>
      ) : null}
      {footer}
    </DialogShell>
  );
}

