"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";
import { ToastCard } from "@/components/layout/toast-card";
import { useUiStore } from "@/stores/ui-store";

const TOAST_DURATION_MS = 3600;

export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts);
  const removeToast = useUiStore((state) => state.removeToast);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        removeToast(toast.id);
      }, TOAST_DURATION_MS)
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, removeToast]);

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3 md:top-4 md:justify-end md:px-4"
    >
      <div className="flex w-full max-w-[24rem] flex-col gap-2.5">
        {toasts.map((toast) => {
          return (
            <ToastCard
              key={toast.id}
              kind={toast.kind}
              role={toast.kind === "error" ? "alert" : "status"}
              message={toast.message}
              detail={toast.detail}
              action={
                <button
                  type="button"
                  aria-label="토스트 닫기"
                  className={cn(
                    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-foreground/34 transition-colors md:h-7 md:w-7",
                    toast.kind === "success" && "hover:bg-white/72 hover:text-success/88",
                    toast.kind === "error" && "hover:bg-white/76 hover:text-danger/92",
                    toast.kind === "info" && "hover:bg-white/74 hover:text-primary-hover/90"
                  )}
                  onClick={() => removeToast(toast.id)}
                >
                  <X className="h-[15px] w-[15px]" />
                </button>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
