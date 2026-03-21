"use client";

import { type ComponentProps, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";

import { PAGE_CONTENT_X_PADDING_CLASS } from "@/components/layout/page-container";
import { GoogleRouteMap } from "@/components/routes/google-route-map";
import { cn } from "@/lib/cn";

export const ROUTE_MOBILE_MAP_PEEK_HEIGHT = 292;
export const ROUTE_MOBILE_SHEET_MAP_OVERLAP = 6;
export const ROUTE_MOBILE_SHEET_PEEK_TOP = ROUTE_MOBILE_MAP_PEEK_HEIGHT - ROUTE_MOBILE_SHEET_MAP_OVERLAP;

function resolveRouteMobileMapPeekHeight() {
  if (typeof window === "undefined") return ROUTE_MOBILE_MAP_PEEK_HEIGHT;

  if (window.innerWidth <= 375) return 276;
  if (window.innerWidth >= 1024) return 332;
  if (window.innerWidth >= 640) return 308;

  return ROUTE_MOBILE_MAP_PEEK_HEIGHT;
}

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
  const mobileMapPeekHeight = resolveRouteMobileMapPeekHeight();
  const sheetPeekTop = mobileMapPeekHeight - ROUTE_MOBILE_SHEET_MAP_OVERLAP;
  const sheetTop = (mobileSheetMode === "peek" ? sheetPeekTop : 0) + sheetDragOffset;
  const shouldShowMapOverlay = sheetTop >= 96;

  return (
    <div
      className="relative flex-1 min-h-144 overflow-hidden bg-card lg:hidden lg:mb-0"
      style={{
        marginInline: "calc(var(--page-x-padding) * -1)",
        marginBottom: "calc(var(--bottom-nav-gap) * -1)",
        width: "calc(100% + (var(--page-x-padding) * 2))"
      }}
    >
      <div className="absolute inset-x-0 top-0" style={{ bottom: `calc(100% - ${mobileMapPeekHeight}px)` }}>
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
        {shouldShowMapOverlay ? mapOverlay : null}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background/55 to-transparent" />

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-x-hidden border-t border-border bg-white shadow-floating",
          mobileSheetMode === "full" && sheetDragOffset <= 16 ? "rounded-none" : "rounded-t-2xl md:rounded-t-3xl",
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
