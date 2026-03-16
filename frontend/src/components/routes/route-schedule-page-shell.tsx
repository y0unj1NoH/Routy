"use client";

import { Trash2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { GoogleRouteMap } from "@/components/routes/google-route-map";
import { RouteMobileSplitLayout } from "@/components/routes/route-mobile-split-layout";
import { RouteViewModeSliderToggle } from "@/components/routes/route-view-mode-slider-toggle";
import type { RouteViewMode } from "@/components/routes/route-view-mode";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type RouteScheduleMapProps = Pick<
  ComponentProps<typeof GoogleRouteMap>,
  | "activePointId"
  | "fallbackUrl"
  | "focusPointId"
  | "focusPointRequestKey"
  | "onPointClick"
  | "points"
  | "showStayOverlay"
  | "stayMarker"
  | "stayRecommendation"
>;

type RouteSchedulePageShellProps = {
  baseClassName?: string;
  daySelector: ReactNode;
  deleteButtonLabel: string;
  deleteBusy?: boolean;
  deleteDialog?: ReactNode;
  desktopAsideTop?: ReactNode;
  desktopStopList: ReactNode;
  desktopMapOverlay?: ReactNode;
  headerActions?: ReactNode;
  headerLeading: ReactNode;
  listLabel: string;
  listModeClassName?: string;
  listModeStopList: ReactNode;
  listModeTop?: ReactNode;
  mobileFooter?: ReactNode;
  mobileMapOverlay?: ReactNode;
  mobileSplit: Omit<ComponentProps<typeof RouteMobileSplitLayout>, "sheetContent">;
  mobileStopList: ReactNode;
  onDelete: () => void;
  onViewModeChange: (value: RouteViewMode) => void;
  preBody?: ReactNode;
  splitLabel: string;
  splitModeClassName?: string;
  viewMode: RouteViewMode;
  desktopMap: RouteScheduleMapProps;
};

export function RouteSchedulePageShell({
  baseClassName,
  daySelector,
  deleteButtonLabel,
  deleteBusy = false,
  deleteDialog,
  desktopAsideTop,
  desktopMap,
  desktopMapOverlay,
  desktopStopList,
  headerActions,
  headerLeading,
  listLabel,
  listModeClassName,
  listModeStopList,
  listModeTop,
  mobileFooter,
  mobileMapOverlay,
  mobileSplit,
  mobileStopList,
  onDelete,
  onViewModeChange,
  preBody,
  splitLabel,
  splitModeClassName,
  viewMode
}: RouteSchedulePageShellProps) {
  return (
    <PageContainer
      className={cn(
        "flex flex-1 flex-col gap-4 lg:h-[calc(100dvh-var(--bottom-nav-offset))] lg:max-h-[calc(100dvh-var(--bottom-nav-offset))] lg:min-h-0 lg:overflow-hidden lg:pb-0",
        baseClassName,
        viewMode === "split" ? splitModeClassName : listModeClassName
      )}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 lg:flex-nowrap lg:items-center">
        {headerLeading}
        {headerActions ? (
          headerActions
        ) : (
          <div className="flex flex-wrap items-center gap-2 self-start">
            <RouteViewModeSliderToggle
              value={viewMode}
              onChange={onViewModeChange}
              splitLabel={splitLabel}
              listLabel={listLabel}
            />
            <Button
              size="sm"
              variant="danger"
              className="shrink-0 shadow-[0_6px_14px_rgba(228,110,124,0.12)]"
              onClick={onDelete}
              disabled={deleteBusy}
            >
              <Trash2 className="mr-2 h-4 w-4" /> {deleteButtonLabel}
            </Button>
          </div>
        )}
      </div>

      {preBody}

      {viewMode === "split" ? (
        <>
          <RouteMobileSplitLayout
            {...mobileSplit}
            mapOverlay={mobileMapOverlay}
            sheetContent={
              <>
                {daySelector}
                {mobileStopList}
              </>
            }
          />

          <div className="hidden flex-1 gap-4 lg:grid lg:min-h-0 lg:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col gap-4">
              {desktopAsideTop}
              {daySelector}
              {desktopStopList}
            </aside>
            <section className="relative min-h-0 overflow-hidden rounded-2xl border border-border shadow-[0_16px_34px_rgba(56,123,194,0.1)]">
              <GoogleRouteMap {...desktopMap} className="absolute inset-0 h-full w-full" />
              {desktopMapOverlay}
            </section>
          </div>
        </>
      ) : (
        <div className="mx-auto flex w-full flex-1 flex-col gap-4 lg:min-h-0">
          {listModeTop}
          {daySelector}
          {listModeStopList}
        </div>
      )}

      {mobileFooter}
      {deleteDialog}
    </PageContainer>
  );
}
