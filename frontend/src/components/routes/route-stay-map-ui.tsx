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
    <div className="rounded-xl border border-white/90 bg-white/94 px-2 py-1.5 shadow-floating backdrop-blur-sm md:rounded-xl md:px-3 md:py-2">
      <div className="flex items-center gap-1.5 md:gap-2">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500 text-white shadow-subtle md:h-6 md:w-6">
          <Home className="h-2.5 w-2.5 md:h-3 md:w-3" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-semibold leading-none text-slate-900 md:text-xs">{title}</p>
        </div>
        <button
          type="button"
          aria-pressed={enabled}
          aria-label={`${title} ${enabled ? "끄기" : "켜기"}`}
          onClick={onToggle}
          className={cn(
            "relative inline-flex h-5 w-8 shrink-0 rounded-full border transition-colors duration-200 md:h-[22px] md:w-9",
            enabled ? "border-teal-500 bg-teal-500" : "border-border bg-slate-200"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 inline-flex h-3.5 w-3.5 rounded-full bg-white shadow-thumb transition-transform duration-200 md:h-4 md:w-4",
              enabled ? "translate-x-4 md:translate-x-[1.05rem]" : "translate-x-0.5"
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
      <div className="rounded-lg border border-teal-300/70 bg-white/96 px-2 py-1 text-[10px] font-semibold text-teal-700 shadow-floating md:rounded-2xl md:px-3 md:py-2 md:text-xs">
        {UI_COPY.routes.recommendation.stayOverlay.recommendationHint}
      </div>
      {wideSpread ? (
        <p className="rounded-full bg-slate-950/72 px-2.5 py-0.5 text-[10px] font-medium text-white shadow-floating md:px-3 md:py-1 md:text-xs">
          {UI_COPY.routes.recommendation.stayOverlay.wideSpreadHint}
        </p>
      ) : null}
    </div>
  );
}
