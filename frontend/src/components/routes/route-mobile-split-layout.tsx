"use client";

import { type ComponentProps, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";

import { PAGE_CONTENT_X_PADDING_CLASS } from "@/components/layout/page-container";
import { GoogleRouteMap } from "@/components/routes/google-route-map";
import { cn } from "@/lib/cn";

export const ROUTE_MOBILE_MAP_PEEK_HEIGHT = 320;
export const ROUTE_MOBILE_SHEET_MAP_OVERLAP = 6;
export const ROUTE_MOBILE_SHEET_PEEK_TOP = ROUTE_MOBILE_MAP_PEEK_HEIGHT - ROUTE_MOBILE_SHEET_MAP_OVERLAP;

type RouteMobileSplitLayoutProps = {
  activePointId: string | null;
  fallbackUrl: string;
  focusPointId?: string | null;
  focusPointRequestKey?: number;
  mobileSheetMode: "peek" | "full";
  sheetDragOffset: number;
  isSheetDragging: boolean;
  onPointClick: (stopId: string) => void;
  onSheetPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSheetPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSheetPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  points: { id: string; lat: number; lng: number; label: string }[];
  scrollRef: RefObject<HTMLDivElement | null>;
  sheetContent: ReactNode;
  sheetScrollClassName?: string;
  mapOverlay?: ReactNode;
  showStayOverlay?: boolean;
  stayMarker?: ComponentProps<typeof GoogleRouteMap>["stayMarker"];
  stayRecommendation?: ComponentProps<typeof GoogleRouteMap>["stayRecommendation"];
};

export function RouteMobileSplitLayout({
  activePointId,
  fallbackUrl,
  focusPointId,
  focusPointRequestKey = 0,
  mobileSheetMode,
  sheetDragOffset,
  isSheetDragging,
  onPointClick,
  onSheetPointerDown,
  onSheetPointerMove,
  onSheetPointerEnd,
  points,
  scrollRef,
  sheetContent,
  sheetScrollClassName,
  mapOverlay,
  showStayOverlay = true,
  stayMarker,
  stayRecommendation
}: RouteMobileSplitLayoutProps) {
  const sheetTop = (mobileSheetMode === "peek" ? ROUTE_MOBILE_SHEET_PEEK_TOP : 0) + sheetDragOffset;

  return (
    <div className="relative left-1/2 right-1/2 flex-1 min-h-144 w-screen -ml-[50vw] -mr-[50vw] overflow-hidden bg-card lg:hidden lg:mb-0">
      <div className="absolute inset-x-0 top-0" style={{ bottom: `calc(100% - ${ROUTE_MOBILE_MAP_PEEK_HEIGHT}px)` }}>
        <GoogleRouteMap
          points={points}
          activePointId={activePointId}
          focusPointId={focusPointId}
          focusPointRequestKey={focusPointRequestKey}
          onPointClick={onPointClick}
          fallbackUrl={fallbackUrl}
          showStayOverlay={showStayOverlay}
          stayMarker={stayMarker}
          stayRecommendation={stayRecommendation}
          className="route-map-mobile h-full w-full"
        />
        {mapOverlay}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background/55 to-transparent" />

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-x-hidden border-t border-border bg-white shadow-[0_-12px_28px_rgba(24,72,136,0.1)]",
          mobileSheetMode === "full" && sheetDragOffset <= 16 ? "rounded-none" : "rounded-t-[28px]",
          !isSheetDragging && "transition-[top,border-radius] duration-300 ease-out"
        )}
        style={{ top: `${sheetTop}px` }}
      >
        <div
          className="flex shrink-0 cursor-grab items-center justify-center px-4 py-4 touch-none active:cursor-grabbing"
          onPointerDown={onSheetPointerDown}
          onPointerMove={onSheetPointerMove}
          onPointerUp={onSheetPointerEnd}
          onPointerCancel={onSheetPointerEnd}
        >
          <span className="h-1.5 w-14 rounded-full bg-border-strong" />
        </div>
        <div
          ref={scrollRef}
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-y-contain scroll-smooth motion-reduce:scroll-auto pb-4",
            PAGE_CONTENT_X_PADDING_CLASS,
            sheetScrollClassName
          )}
        >
          {sheetContent}
        </div>
      </div>
    </div>
  );
}
