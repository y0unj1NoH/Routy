"use client";

import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/cn";
import type { ToastMessage } from "@/stores/ui-store";

type ToastCardProps = {
  kind: ToastMessage["kind"];
  message: ReactNode;
  role?: "status" | "alert";
  action?: ReactNode;
  className?: string;
};

const TOAST_TONES: Record<
  ToastMessage["kind"],
  {
    container: string;
    iconWrap: string;
    icon: string;
  }
> = {
  success: {
    container: "border-success/18 bg-[linear-gradient(135deg,rgba(230,247,239,0.98),rgba(255,255,255,0.98)_74%)]",
    iconWrap: "border-success/18 bg-success/12 text-success shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
    icon: "text-success"
  },
  error: {
    container: "border-danger/22 bg-[linear-gradient(135deg,rgba(255,239,242,0.98),rgba(255,255,255,0.98)_78%)]",
    iconWrap: "border-danger/22 bg-danger/12 text-danger shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
    icon: "text-danger"
  },
  info: {
    container: "border-primary-light/44 bg-[linear-gradient(135deg,rgba(236,248,255,0.98),rgba(255,255,255,0.98)_72%)]",
    iconWrap: "border-primary-light/42 bg-primary/10 text-primary-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
    icon: "text-primary-hover"
  }
};

const TOAST_ICONS: Record<ToastMessage["kind"], typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
};

export function ToastCard({ kind, message, role, action, className }: ToastCardProps) {
  const tone = TOAST_TONES[kind];
  const Icon = TOAST_ICONS[kind];

  return (
    <div
      role={role}
      className={cn(
        "pointer-events-auto overflow-hidden rounded-2xl border shadow-floating backdrop-blur-md",
        "animate-fade-up",
        tone.container,
        className
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 p-3 md:gap-3 md:p-3.5">
        <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border md:h-8.5 md:w-8.5", tone.iconWrap)}>
          <Icon className={cn("h-[15px] w-[15px] md:h-4 md:w-4", tone.icon)} />
        </div>

        <div className="min-w-0 flex-1 pr-1">
          <p className="break-keep text-[13px] font-semibold leading-[1.45] text-foreground/82 md:text-sm md:leading-[1.45]">
            {message}
          </p>
        </div>

        {action ? <div className="shrink-0">{action}</div> : <div aria-hidden className="h-0 w-0" />}
      </div>
    </div>
  );
}
