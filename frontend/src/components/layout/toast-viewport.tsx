"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { useUiStore } from "@/stores/ui-store";

const ICON_MAP = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
} as const;

const ICON_CLASS_MAP = {
  success: "text-success",
  error: "text-danger",
  info: "text-primary"
} as const;

export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts);
  const removeToast = useUiStore((state) => state.removeToast);

  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        removeToast(toast.id);
      }, 3600)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(90vw,360px)] flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = ICON_MAP[toast.kind];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex animate-fade-up items-start gap-3 rounded-xl border border-border/80 bg-card/92 p-3 text-sm shadow-soft backdrop-blur-xs"
          >
            <Icon className={`mt-0.5 h-4 w-4 ${ICON_CLASS_MAP[toast.kind]}`} />
            <p>{toast.message}</p>
          </div>
        );
      })}
    </div>
  );
}
