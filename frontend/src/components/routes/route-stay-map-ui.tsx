"use client";

import { Home } from "lucide-react";

import { UI_COPY } from "@/constants/ui-copy";
import type { RouteStayOverlayMode } from "@/lib/route-stay";
import { cn } from "@/lib/cn";

type RouteStayMapControlProps = {
  enabled: boolean;
  mode: RouteStayOverlayMode;
  onToggle: () => void;
};

export function RouteStayMapControl({ enabled, mode, onToggle }: RouteStayMapControlProps) {
  const title =
    mode === "stay"
      ? UI_COPY.routes.recommendation.stayOverlay.stayLabel
      : UI_COPY.routes.recommendation.stayOverlay.recommendationLabel;

  return (
    <div className="rounded-[18px] border border-white/90 bg-white/94 px-2.5 py-2 shadow-[0_14px_28px_rgba(15,23,42,0.12)] backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[12px] bg-teal-500 text-white shadow-[0_10px_18px_rgba(15,23,42,0.1)]">
          <Home className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold leading-none text-slate-900">{title}</p>
        </div>
        <button
          type="button"
          aria-pressed={enabled}
          aria-label={`${title} ${enabled ? "끄기" : "켜기"}`}
          onClick={onToggle}
          className={cn(
            "relative inline-flex h-6 w-10 shrink-0 rounded-full border transition-colors duration-200",
            enabled ? "border-teal-500 bg-teal-500" : "border-border bg-slate-200"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 inline-flex h-[18px] w-[18px] rounded-full bg-white shadow-[0_8px_16px_rgba(15,23,42,0.16)] transition-transform duration-200",
              enabled ? "translate-x-[1.05rem]" : "translate-x-0.5"
            )}
          />
        </button>
      </div>
    </div>
  );
}

export function RouteStayRecommendationCallout({ wideSpread = false }: { wideSpread?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex flex-col items-center gap-1 px-4">
      <div className="rounded-[22px] border border-teal-300/70 bg-white/96 px-3 py-2 text-xs font-semibold text-teal-700 shadow-[0_14px_28px_rgba(20,184,166,0.14)]">
        {UI_COPY.routes.recommendation.stayOverlay.recommendationHint}
      </div>
      {wideSpread ? (
        <p className="rounded-full bg-slate-950/72 px-3 py-1 text-[11px] font-medium text-white shadow-[0_10px_18px_rgba(15,23,42,0.2)]">
          {UI_COPY.routes.recommendation.stayOverlay.wideSpreadHint}
        </p>
      ) : null}
    </div>
  );
}
