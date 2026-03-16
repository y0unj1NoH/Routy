"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CelebrationConfetti,
  type CelebrationConfettiVariant
} from "@/components/common/celebration-confetti";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading-panel";
import { PageBackButton } from "@/components/common/page-back-button";
import { CelebrationMascot } from "@/components/layout/celebration-mascot";
import { PAGE_CONTENT_X_PADDING_CLASS, PageContainer } from "@/components/layout/page-container";
import { RouteDaySelector } from "@/components/routes/route-day-selector";
import { RouteSchedulePageShell } from "@/components/routes/route-schedule-page-shell";
import { RouteStopCard } from "@/components/routes/route-stop-card";
import { RouteStopList } from "@/components/routes/route-stop-list";
import type { RouteViewMode } from "@/components/routes/route-view-mode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UI_COPY } from "@/constants/ui-copy";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useRouteStopInteractions } from "@/hooks/use-route-stop-interactions";
import { cn } from "@/lib/cn";
import { deleteSchedule, fetchScheduleDetail, regenerateSchedule } from "@/lib/graphql/api";
import { buildGoogleDirectionsEmbedUrl } from "@/lib/maps";
import { queryKeys } from "@/lib/query-keys";
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<RouteViewMode>("split");

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

  const deleteMutation = useMutation({
    mutationFn: () => deleteSchedule(accessToken || "", scheduleId || ""),
    onSuccess: () => {
      pushToast({ kind: "success", message: UI_COPY.routes.detail.toast.deleteSuccess });
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleDetail(scheduleId || "") });
      queryClient.invalidateQueries({ queryKey: queryKeys.mySchedules });
      router.replace("/");
    },
    onError: (error: Error) => {
      console.error(error);
      pushToast({ kind: "error", message: UI_COPY.routes.detail.toast.deleteError });
    }
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

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace("/routes/new?step=list");
  };

  const handleConfirmRoute = () => {
    if (!scheduleId) return;
    router.push(`/routes/${scheduleId}`);
  };

  const renderPreviewHero = (className?: string) => (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/70 bg-card/76 px-4 py-3.5 shadow-soft",
        className
      )}
    >
      <div className="pr-22">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary">{schedule?.placeList.city}</Badge>
          <div className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-semibold text-foreground/68 shadow-xs">
            {headingRange}
          </div>
        </div>
        <h1 className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap text-[1.28rem] font-black leading-[1.16] tracking-[-0.03em] text-foreground sm:text-[1.42rem]">
          {UI_COPY.routes.recommendation.heroTitle(schedule?.placeList.city)}
        </h1>
        <p className="mt-1.5 line-clamp-2 text-[12px] font-medium text-foreground/58">{UI_COPY.routes.recommendation.heroDescription}</p>
      </div>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-primary-soft/70 p-1.5">
        <CelebrationMascot className="h-20 w-20" />
      </div>
    </section>
  );

  const renderActionPanel = (className?: string) => (
    <section
      className={cn(
        "rounded-2xl border border-border/70 bg-background/92 p-3 shadow-[0_16px_32px_rgba(24,72,136,0.08)]",
        className
      )}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/42">{UI_COPY.routes.recommendation.readyTitle}</p>
      <div className="mt-2 flex flex-col gap-3">
        <p className="text-sm font-medium leading-6 text-foreground/68">{UI_COPY.routes.recommendation.actionDescription}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            className="h-11 flex-1 rounded-2xl px-4 text-sm font-semibold shadow-none"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending || deleteMutation.isPending}
          >
            {UI_COPY.routes.recommendation.regenerateAction}
          </Button>
          <Button
            type="button"
            className="h-11 flex-[1.15] rounded-2xl px-5 text-sm font-semibold shadow-[0_12px_28px_rgba(56,123,194,0.22)]"
            onClick={handleConfirmRoute}
            disabled={regenerateMutation.isPending || deleteMutation.isPending}
          >
            {UI_COPY.routes.recommendation.confirmAction}
          </Button>
        </div>
      </div>
    </section>
  );

  const renderStopCard = useCallback(
    (stop: ScheduleStop, isActive: boolean) => (
      <RouteStopCard
        stop={stop}
        detailHref={currentDay?.date ? `/places/${stop.place.id}?visitDate=${encodeURIComponent(currentDay.date)}` : `/places/${stop.place.id}`}
        isActive={isActive}
        onFocus={focusStopFromCard}
        showMapAction={viewMode === "list"}
        showNoteSection={false}
      />
    ),
    [currentDay?.date, focusStopFromCard, viewMode]
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
            <Button size="lg" onClick={() => router.replace("/routes/new?step=list")}>
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
            <Button size="lg" onClick={() => router.replace("/routes/new?step=list")}>
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
            <Button size="lg" onClick={() => scheduleQuery.refetch()}>
              {UI_COPY.routes.recommendation.fetchError.action}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const desktopTopContent = (
    <>
      {renderPreviewHero("hidden lg:block")}
      {renderActionPanel("hidden lg:block")}
    </>
  );

  return (
    <>
      <CelebrationConfetti variant={RECOMMENDATION_CONFETTI_VARIANT} />
      <RouteSchedulePageShell
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        splitLabel={UI_COPY.routes.detail.splitView}
        listLabel={UI_COPY.routes.detail.listView}
        deleteButtonLabel={UI_COPY.routes.detail.deleteAction}
        deleteBusy={deleteMutation.isPending}
        onDelete={() => setIsDeleteDialogOpen(true)}
        baseClassName="pt-4 lg:pt-5"
        splitModeClassName="min-h-0 overflow-y-hidden pb-0 md:pb-0"
        listModeClassName="pb-[calc(11rem+env(safe-area-inset-bottom))] lg:pb-4"
        headerLeading={<PageBackButton onClick={handleBack} />}
        preBody={renderPreviewHero("lg:hidden")}
        desktopAsideTop={desktopTopContent}
        listModeTop={desktopTopContent}
        daySelector={
          <RouteDaySelector
            days={scheduleDays}
            currentDayDate={currentDay?.date}
            currentDayNumber={currentDay?.dayNumber}
            onSelectDay={setSelectedDay}
          />
        }
        mobileStopList={<RouteStopList day={currentDay} activeStopId={activeStopId} refs={listRefs.mobile} className="shrink-0" renderStopCard={renderStopCard} />}
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
          mobileSheetMode,
          sheetDragOffset,
          isSheetDragging,
          onSheetPointerDown: handleSheetPointerDown,
          onSheetPointerMove: handleSheetPointerMove,
          onSheetPointerEnd: handleSheetPointerEnd,
          scrollRef: listRefs.mobile.scrollRef,
          sheetScrollClassName: "pb-[calc(7.5rem+env(safe-area-inset-bottom))]"
        }}
        desktopMap={{
          points: currentDayPoints,
          activePointId: activeStopId,
          focusPointId: mapFocusRequest.pointId,
          focusPointRequestKey: mapFocusRequest.key,
          onPointClick: focusStopFromMap,
          fallbackUrl: routeMapUrl
        }}
        mobileFooter={
          <div
            className={cn(
              "fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 lg:hidden",
              PAGE_CONTENT_X_PADDING_CLASS
            )}
          >
            <div className="mx-auto w-full max-w-[960px] rounded-[28px] border border-border/70 bg-background/92 p-3 shadow-[0_18px_40px_rgba(24,72,136,0.14)] backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 flex-1 rounded-2xl px-4 text-sm font-semibold shadow-none"
                  onClick={() => regenerateMutation.mutate()}
                  disabled={regenerateMutation.isPending || deleteMutation.isPending}
                >
                  {UI_COPY.routes.recommendation.regenerateAction}
                </Button>
                <Button
                  type="button"
                  className="h-12 flex-[1.15] rounded-2xl px-5 text-sm font-semibold shadow-[0_12px_28px_rgba(56,123,194,0.22)]"
                  onClick={handleConfirmRoute}
                  disabled={regenerateMutation.isPending || deleteMutation.isPending}
                >
                  {UI_COPY.routes.recommendation.confirmAction}
                </Button>
              </div>
            </div>
          </div>
        }
        deleteDialog={
          <ConfirmDialog
            open={isDeleteDialogOpen}
            title={UI_COPY.common.deleteConfirm.title}
            description={UI_COPY.common.deleteConfirm.description}
            confirmLabel={deleteMutation.isPending ? UI_COPY.common.deleteConfirm.confirming : UI_COPY.common.deleteConfirm.confirm}
            cancelLabel={UI_COPY.common.deleteConfirm.cancel}
            busy={deleteMutation.isPending}
            intent="danger"
            onClose={() => setIsDeleteDialogOpen(false)}
            onConfirm={() => deleteMutation.mutate()}
          />
        }
      />
    </>
  );
}
