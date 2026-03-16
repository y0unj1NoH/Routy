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

  const resolvedMascotVariant = intent === "danger" ? "surprise" : mascotVariant;
  const resolvedDescription = description || UI_COPY.common.deleteConfirm.description;
  const resolvedEyebrow = intent === "danger" ? "Delete Confirm" : undefined;

  return (
    <DialogShell
      open={open}
      eyebrow={resolvedEyebrow}
      title={title}
      description={undefined}
      busy={busy}
      mascotVariant={resolvedMascotVariant}
      headerClassName="bg-[linear-gradient(135deg,rgba(232,244,255,0.94),rgba(255,255,255,1)_72%)]"
      showCloseButton={false}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" className="min-w-[88px]" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={intent === "danger" ? "danger" : "primary"}
            size="sm"
            className="min-w-[88px]"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {resolvedDescription ? (
        <div className="flex items-center gap-3 rounded-[22px] border border-danger/24 bg-danger/8 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.04)]">
          <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
          <p className="text-sm leading-6 text-foreground/72">{resolvedDescription}</p>
        </div>
      ) : null}
      {footer}
    </DialogShell>
  );
}
