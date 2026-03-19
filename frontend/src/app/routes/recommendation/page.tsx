"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CelebrationConfetti,
  type CelebrationConfettiVariant
} from "@/components/common/celebration-confetti";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading-panel";
import { CelebrationMascot } from "@/components/layout/celebration-mascot";
import { PAGE_CONTENT_X_PADDING_CLASS, PageContainer } from "@/components/layout/page-container";
import { RouteDaySelector } from "@/components/routes/route-day-selector";
import { RouteSchedulePageShell } from "@/components/routes/route-schedule-page-shell";
import { RouteStayMapControl, RouteStayRecommendationCallout } from "@/components/routes/route-stay-map-ui";
import { RouteStopCard } from "@/components/routes/route-stop-card";
import { RouteStopList } from "@/components/routes/route-stop-list";
import { RouteViewModeSliderToggle } from "@/components/routes/route-view-mode-slider-toggle";
import type { RouteViewMode } from "@/components/routes/route-view-mode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UI_COPY } from "@/constants/ui-copy";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useRouteStopInteractions } from "@/hooks/use-route-stop-interactions";
import { cn } from "@/lib/cn";
import { fetchScheduleDetail, regenerateSchedule } from "@/lib/graphql/api";
import { buildGoogleDirectionsEmbedUrl } from "@/lib/maps";
import { queryKeys } from "@/lib/query-keys";
import { getRouteStayMarker, getRouteStayOverlayMode, getRouteStayRecommendation } from "@/lib/route-stay";
import { useUiStore } from "@/stores/ui-store";
import type { Schedule, ScheduleStop } from "@/types/domain";

const RECOMMENDATION_CONFETTI_VARIANT: CelebrationConfettiVariant = "default";

function buildDayPoints(day: Schedule["days"][number] | null) {
  return (day?.stops || [])
    .map((stop, index) => ({
      id: stop.id,
      lat: stop.place.lat,
      lng: stop.place.lng,
      label: String(index + 1)
    }))
    .filter((point): point is { id: string; lat: number; lng: number; label: string } => typeof point.lat === "number" && typeof point.lng === "number");
}

function formatShortDateRange(startDate: string, endDate: string) {
  const parse = (value: string) => {
    const [yearRaw, monthRaw, dayRaw] = value.split("-");
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    return new Date(year, month - 1, day);
  };
  const start = parse(startDate);
  const end = parse(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "n/n~n/n";
  return `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`;
}

export default function RecommendationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pushToast = useUiStore((state) => state.pushToast);
  const { session, isLoading, isAuthed } = useRequireAuth();
  const accessToken = session?.access_token;

  const [paramsReady, setParamsReady] = useState(false);
  const [status, setStatus] = useState("pending");
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [viewMode, setViewMode] = useState<RouteViewMode>("split");
  const [isMobileHeroCollapsed, setIsMobileHeroCollapsed] = useState(false);
  const [isStayOverlayVisible, setIsStayOverlayVisible] = useState(true);

  useEffect(() => {
    const currentParams = new URLSearchParams(window.location.search);
    setStatus(currentParams.get("status") || "pending");
    setScheduleId(currentParams.get("scheduleId"));
    setParamsReady(true);
  }, []);

  const scheduleQuery = useQuery({
    queryKey: queryKeys.scheduleDetail(scheduleId || "missing"),
    queryFn: () => fetchScheduleDetail(scheduleId || "", accessToken || ""),
    enabled: Boolean(paramsReady && accessToken && scheduleId && status !== "error")
  });

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateSchedule(accessToken || "", scheduleId || ""),
    onSuccess: (regeneratedSchedule) => {
      const nextScheduleId = regeneratedSchedule?.id || scheduleId || "";
      pushToast({ kind: "success", message: UI_COPY.routes.recommendation.toast.regenerateSuccess });
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleDetail(nextScheduleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mySchedules });

      if (regeneratedSchedule?.id && regeneratedSchedule.id !== scheduleId) {
        setScheduleId(regeneratedSchedule.id);
        router.replace(`/routes/recommendation?scheduleId=${encodeURIComponent(regeneratedSchedule.id)}&status=success`);
      }
    },
    onError: (error: Error) => {
      console.error(error);
      pushToast({ kind: "error", message: UI_COPY.routes.recommendation.toast.regenerateError });
    }
  });

  const schedule = scheduleQuery.data;
  const scheduleDays = useMemo(() => schedule?.days ?? [], [schedule?.days]);
  const currentDay = useMemo(() => {
    if (scheduleDays.length === 0) return null;
    return scheduleDays.find((day) => day.dayNumber === selectedDay) || scheduleDays[0];
  }, [scheduleDays, selectedDay]);

  const currentDayStops = useMemo(() => currentDay?.stops ?? [], [currentDay]);
  const stayMarker = useMemo(() => getRouteStayMarker(schedule?.stayPlace ?? null), [schedule?.stayPlace]);
  const stayRecommendation = useMemo(
    () => getRouteStayRecommendation(schedule?.stayRecommendation ?? null),
    [schedule?.stayRecommendation]
  );
  const stayOverlayMode = useMemo(
    () => getRouteStayOverlayMode({ stayPlace: schedule?.stayPlace ?? null, stayRecommendation: schedule?.stayRecommendation ?? null }),
    [schedule?.stayPlace, schedule?.stayRecommendation]
  );
  const currentDayPoints = useMemo(() => buildDayPoints(currentDay), [currentDay]);
  const routeMapUrl = useMemo(
    () => buildGoogleDirectionsEmbedUrl(currentDayPoints, schedule?.placeList.city),
    [currentDayPoints, schedule?.placeList.city]
  );
  const headingRange = useMemo(
    () => (schedule ? formatShortDateRange(schedule.startDate, schedule.endDate) : "n/n~n/n"),
    [schedule]
  );

  const {
    activeStopId,
    focusStopFromCard,
    focusStopFromMap,
    handleSheetPointerDown,
    handleSheetPointerMove,
    handleSheetPointerEnd,
    isSheetDragging,
    listRefs,
    mapFocusRequest,
    mobileSheetMode,
    sheetDragOffset
  } = useRouteStopInteractions({
    currentDayId: currentDay?.id,
    currentDayStops,
    stopFocusTopOffset: 16,
    viewMode
  });

  const handleClose = () => {
    router.replace("/");
  };

  const handleConfirmRoute = () => {
    if (!scheduleId) return;
    router.push(`/routes/${scheduleId}`);
  };

  useEffect(() => {
    setIsStayOverlayVisible(true);
  }, [scheduleId, stayOverlayMode]);

  useEffect(() => {
    setIsMobileHeroCollapsed(false);
  }, [scheduleId]);

  const renderPreviewHero = (className?: string, mobileCollapsible = false) => (
    <section
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-border/70 bg-card/76 px-4 pt-3.5 pb-7 shadow-surface md:rounded-2xl md:px-5 md:py-4",
        className
      )}
    >
      {mobileCollapsible ? (
        <Button
          type="button"
          variant="ghost"
          size="small"
          iconOnly
          onClick={() => setIsMobileHeroCollapsed(true)}
          aria-label="추천 요약 숨기기"
          className="absolute bottom-1.5 left-1/2 z-10 -translate-x-1/2 text-foreground/52 hover:text-foreground lg:hidden"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      <div className="pr-20 md:pr-24">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary">{schedule?.placeList.city}</Badge>
          <Badge size="compact" className="border-border/70 bg-background/80 text-foreground/68 shadow-subtle">
            {headingRange}
          </Badge>
        </div>
        <h1 className="mt-2.5 overflow-hidden text-ellipsis whitespace-nowrap font-black leading-[1.2] tracking-[-0.03em] text-foreground" style={{ fontSize: "var(--card-title-size)" }}>
          {UI_COPY.routes.recommendation.heroTitle(schedule?.placeList.city)}
        </h1>
        <p
          className="mt-1.5 line-clamp-2 break-keep leading-[1.5] text-foreground/65"
          style={{ fontSize: "var(--page-subtitle-size)" }}
        >
          {stayOverlayMode === "stay"
            ? UI_COPY.routes.recommendation.heroDescriptionWithStay
            : stayOverlayMode === "recommendation"
              ? UI_COPY.routes.recommendation.heroDescriptionWithRecommendation
              : UI_COPY.routes.recommendation.heroDescription}
        </p>
      </div>
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-primary-soft/70 p-1.5 md:p-2">
        <CelebrationMascot />
      </div>
    </section>
  );

  const renderMobilePreviewHero = () => (
    <div className="lg:hidden">
      <div
        aria-hidden={isMobileHeroCollapsed}
        className={cn(
          "grid overflow-hidden rounded-xl transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none md:rounded-2xl",
          isMobileHeroCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden rounded-[inherit]">
          <div
            className={cn(
              "transition-[opacity,transform,scale] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              isMobileHeroCollapsed ? "opacity-0 -translate-y-3 scale-[0.985]" : "opacity-100 translate-y-0 scale-100"
            )}
          >
            {renderPreviewHero(undefined, true)}
          </div>
        </div>
      </div>
      <div
        aria-hidden={!isMobileHeroCollapsed}
        className={cn(
          "flex justify-center overflow-hidden transition-[max-height,opacity,margin,transform] duration-260 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          isMobileHeroCollapsed
            ? "mt-0.5 max-h-10 opacity-100 translate-y-0 delay-75"
            : "pointer-events-none max-h-0 opacity-0 -translate-y-2"
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="small"
          iconOnly
          onClick={() => setIsMobileHeroCollapsed(false)}
          aria-label="추천 요약 다시 보기"
          className="text-foreground/52 hover:text-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  const stayMapOverlay =
    stayOverlayMode != null ? (
      <>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-end px-3 py-3">
          <div className="pointer-events-auto">
            <RouteStayMapControl
              mode={stayOverlayMode}
              enabled={isStayOverlayVisible}
              onToggle={() => setIsStayOverlayVisible((current) => !current)}
            />
          </div>
        </div>
        {stayOverlayMode === "recommendation" && isStayOverlayVisible ? (
          <RouteStayRecommendationCallout wideSpread={stayRecommendation?.wideSpread} />
        ) : null}
      </>
    ) : null;

  const renderStopCard = useCallback(
    (stop: ScheduleStop, isActive: boolean) => (
      <RouteStopCard
        stop={stop}
        detailHref={currentDay?.date ? `/places/${stop.place.id}?visitDate=${encodeURIComponent(currentDay.date)}` : `/places/${stop.place.id}`}
        isActive={isActive}
        onFocus={focusStopFromCard}
        showMapAction
        showNoteSection={false}
      />
    ),
    [currentDay?.date, focusStopFromCard]
  );

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.common.loading.authCheck} />
      </PageContainer>
    );
  }

  if (!isAuthed) {
    return null;
  }

  if (!paramsReady) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.routes.recommendation.loading.checking} />
      </PageContainer>
    );
  }

  if (status === "error") {
    return (
      <PageContainer>
        <EmptyState
          mascotVariant="surprise"
          title={UI_COPY.routes.recommendation.createError.title}
          description={UI_COPY.routes.recommendation.createError.description}
          action={
            <Button size="large" fullWidth onClick={() => router.replace("/routes/new?step=list")}>
              {UI_COPY.routes.recommendation.createError.action}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (!scheduleId) {
    return (
      <PageContainer>
        <EmptyState
          mascotVariant="surprise"
          title={UI_COPY.routes.recommendation.missingSchedule.title}
          description={UI_COPY.routes.recommendation.missingSchedule.description}
          action={
            <Button size="large" fullWidth onClick={() => router.replace("/routes/new?step=list")}>
              {UI_COPY.routes.recommendation.missingSchedule.action}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (scheduleQuery.isLoading || regenerateMutation.isPending) {
    return (
      <PageContainer>
        <LoadingPanel withMascot mascotVariant="map" message={UI_COPY.routes.recommendation.loading.preparing} />
      </PageContainer>
    );
  }

  if (scheduleQuery.isError || !schedule) {
    return (
      <PageContainer>
        <EmptyState
          mascotVariant="surprise"
          title={UI_COPY.routes.recommendation.fetchError.title}
          description={UI_COPY.routes.recommendation.fetchError.description}
          action={
            <Button size="large" fullWidth onClick={() => scheduleQuery.refetch()}>
              {UI_COPY.routes.recommendation.fetchError.action}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const headerActions = (
    <div className="flex w-full items-center justify-between gap-2">
      <Button
        type="button"
        variant="ghost"
        size="small"
        iconOnly
        className="text-foreground/52 hover:text-foreground"
        aria-label="홈으로 닫기"
        onClick={handleClose}
      >
        <X className="h-4 w-4" />
      </Button>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <RouteViewModeSliderToggle
          compactMobile
          iconOnly
          value={viewMode}
          onChange={setViewMode}
          splitLabel={UI_COPY.routes.detail.splitView}
          listLabel={UI_COPY.routes.detail.listView}
        />
        <div className="hidden lg:flex lg:flex-wrap lg:items-center lg:justify-end lg:gap-2">
          <Button
            type="button"
            size="small"
            variant="secondary"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
          >
            {UI_COPY.routes.recommendation.regenerateAction}
          </Button>
          <Button
            type="button"
            size="small"
            onClick={handleConfirmRoute}
            disabled={regenerateMutation.isPending}
          >
            {UI_COPY.routes.recommendation.confirmAction}
          </Button>
        </div>
      </div>
    </div>
  );

  const desktopTopContent = renderPreviewHero("hidden lg:block");

  return (
    <>
      <CelebrationConfetti variant={RECOMMENDATION_CONFETTI_VARIANT} />
      <RouteSchedulePageShell
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        splitLabel={UI_COPY.routes.detail.splitView}
        listLabel={UI_COPY.routes.detail.listView}
        headerActions={headerActions}
        baseClassName="pt-4 lg:pt-5"
        splitModeClassName="min-h-0 overflow-y-hidden pb-0 md:pb-0"
        listModeClassName="pb-[calc(8.5rem+env(safe-area-inset-bottom))] lg:pb-4"
        preBody={renderMobilePreviewHero()}
        desktopAsideTop={desktopTopContent}
        listModeTop={desktopTopContent}
        daySelector={
          <RouteDaySelector
            compactMobile
            days={scheduleDays}
            currentDayDate={currentDay?.date}
            currentDayNumber={currentDay?.dayNumber}
            onSelectDay={setSelectedDay}
          />
        }
        mobileStopList={
          <RouteStopList
            day={currentDay}
            activeStopId={activeStopId}
            refs={listRefs.mobile}
            className="min-h-0 shrink-0 [&>div:last-child]:pb-0"
            renderStopCard={renderStopCard}
          />
        }
        desktopStopList={
          <RouteStopList
            day={currentDay}
            activeStopId={activeStopId}
            refs={listRefs.desktopSplit}
            className="min-h-0 flex-1 overflow-y-auto"
            renderStopCard={renderStopCard}
          />
        }
        listModeStopList={
          <RouteStopList
            day={currentDay}
            activeStopId={activeStopId}
            refs={listRefs.list}
            className="flex-1 lg:min-h-0 lg:overflow-y-auto"
            renderStopCard={renderStopCard}
          />
        }
        mobileSplit={{
          points: currentDayPoints,
          activePointId: activeStopId,
          focusPointId: mapFocusRequest.pointId,
          focusPointRequestKey: mapFocusRequest.key,
          onPointClick: focusStopFromMap,
          fallbackUrl: routeMapUrl,
          showStayOverlay: isStayOverlayVisible,
          stayMarker,
          stayRecommendation,
          mobileSheetMode,
          sheetDragOffset,
          isSheetDragging,
          onSheetPointerDown: handleSheetPointerDown,
          onSheetPointerMove: handleSheetPointerMove,
          onSheetPointerEnd: handleSheetPointerEnd,
          scrollRef: listRefs.mobile.scrollRef,
          sheetScrollClassName: "pb-[calc(7.5rem+env(safe-area-inset-bottom))]"
        }}
        mobileMapOverlay={stayMapOverlay}
        desktopMap={{
          points: currentDayPoints,
          activePointId: activeStopId,
          focusPointId: mapFocusRequest.pointId,
          focusPointRequestKey: mapFocusRequest.key,
          onPointClick: focusStopFromMap,
          fallbackUrl: routeMapUrl,
          showStayOverlay: isStayOverlayVisible,
          stayMarker,
          stayRecommendation
        }}
        desktopMapOverlay={stayMapOverlay}
        mobileFooter={
          <div className={cn("fixed inset-x-0 z-30 lg:hidden", PAGE_CONTENT_X_PADDING_CLASS)} style={{ bottom: "calc(var(--bottom-nav-offset) - 0.25rem)" }}>
            <div className="mx-auto w-full max-w-[960px] rounded-xl border border-border/70 bg-background/92 p-2.5 shadow-floating backdrop-blur-sm md:rounded-2xl md:p-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="medium"
                  fullWidth
                  className="min-w-0"
                  onClick={() => regenerateMutation.mutate()}
                  disabled={regenerateMutation.isPending}
                >
                  {UI_COPY.routes.recommendation.regenerateAction}
                </Button>
                <Button
                  type="button"
                  size="medium"
                  fullWidth
                  className="min-w-0"
                  onClick={handleConfirmRoute}
                  disabled={regenerateMutation.isPending}
                >
                  {UI_COPY.routes.recommendation.confirmAction}
                </Button>
              </div>
            </div>
          </div>
        }
      />
    </>
  );
}

