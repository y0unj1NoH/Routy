"use client";

import { Check, LoaderCircle, PencilLine, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";

import { PageTitle } from "@/components/common/page-title";
import { RouteDaySelector } from "@/components/routes/route-day-selector";
import { GoogleRouteMap } from "@/components/routes/google-route-map";
import { RouteSchedulePageShell } from "@/components/routes/route-schedule-page-shell";
import { RouteStopCard, type RouteStopCardEditActions } from "@/components/routes/route-stop-card";
import { RouteStopList } from "@/components/routes/route-stop-list";
import { RouteViewModeSliderToggle } from "@/components/routes/route-view-mode-slider-toggle";
import type { RouteViewMode } from "@/components/routes/route-view-mode";
import { Button } from "@/components/ui/button";
import { UI_COPY } from "@/constants/ui-copy";
import { formatDateRange } from "@/lib/format";
import { buildGoogleDirectionsEmbedUrl } from "@/lib/maps";
import { useRouteStopInteractions } from "@/hooks/use-route-stop-interactions";
import type { Schedule, ScheduleDay, ScheduleStop } from "@/types/domain";

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

type RouteDetailViewProps = {
  schedule: Schedule;
  onBack: () => void;
  onDelete?: () => void;
  deleteBusy?: boolean;
  deleteDialog?: ReactNode;
  editingStopId?: string | null;
  isStopNoteSaving?: boolean;
  noteSavingStopId?: string | null;
  onToggleStopNote?: (stopId: string) => void;
  onSaveStopNote?: (stopId: string, note: string | null) => void;
  isEditMode?: boolean;
  onEnterEdit?: () => void;
  onCancelEdit?: () => void;
  onCommitEdit?: () => void;
  editCommitBusy?: boolean;
  editCommitDisabled?: boolean;
  editedDayNumbers?: number[];
  onAddPlace?: (dayNumber: number) => void;
  getStopEditActions?: (stop: ScheduleStop, day: ScheduleDay) => RouteStopCardEditActions | null;
  mobileMapOverlay?: ReactNode;
  desktopMapOverlay?: ReactNode;
  showStayOverlay?: boolean;
  stayMarker?: ComponentProps<typeof GoogleRouteMap>["stayMarker"];
  stayRecommendation?: ComponentProps<typeof GoogleRouteMap>["stayRecommendation"];
};

export function RouteDetailView({
  schedule,
  onBack,
  onDelete,
  deleteBusy = false,
  deleteDialog,
  editingStopId = null,
  isStopNoteSaving = false,
  noteSavingStopId = null,
  onToggleStopNote,
  onSaveStopNote,
  isEditMode = false,
  onEnterEdit,
  onCancelEdit,
  onCommitEdit,
  editCommitBusy = false,
  editCommitDisabled = false,
  editedDayNumbers = [],
  onAddPlace,
  getStopEditActions,
  mobileMapOverlay,
  desktopMapOverlay,
  showStayOverlay = true,
  stayMarker,
  stayRecommendation
}: RouteDetailViewProps) {
  const compactActionButtonClassName = "min-h-8 px-3 py-1.5 text-[12px] md:min-h-10 md:px-3.5 md:py-2 md:text-xs";
  const compactHeaderActionButtonClassName = "w-9 gap-0 px-0 md:w-auto md:gap-1.5 md:px-3.5";
  const [selectedDay, setSelectedDay] = useState(1);
  const [viewMode, setViewMode] = useState<RouteViewMode>("split");
  const editedDaySet = useMemo(() => new Set(editedDayNumbers), [editedDayNumbers]);

  const scheduleDays = useMemo(() => schedule.days ?? [], [schedule.days]);
  const currentDay = useMemo(() => {
    if (scheduleDays.length === 0) return null;
    return scheduleDays.find((day) => day.dayNumber === selectedDay) || scheduleDays[0];
  }, [scheduleDays, selectedDay]);

  useEffect(() => {
    if (scheduleDays.length === 0) {
      setSelectedDay(1);
      return;
    }

    if (!scheduleDays.some((day) => day.dayNumber === selectedDay)) {
      setSelectedDay(scheduleDays[0].dayNumber);
    }
  }, [scheduleDays, selectedDay]);

  const currentDayStops = useMemo(() => currentDay?.stops ?? [], [currentDay]);
  const currentDayPoints = useMemo(() => buildDayPoints(currentDay), [currentDay]);
  const routeMapUrl = useMemo(
    () => buildGoogleDirectionsEmbedUrl(currentDayPoints, schedule.placeList.city),
    [currentDayPoints, schedule.placeList.city]
  );
  const isCurrentDayEdited = currentDay ? editedDaySet.has(currentDay.dayNumber) : false;

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
    stopFocusTopOffset: 12,
    viewMode
  });

  const dayTopContent = useMemo(() => {
    if (!isEditMode) return null;

    return (
      <div className="space-y-3">
        {isCurrentDayEdited ? (
          <div className="rounded-xl border border-[#D8E8FB] bg-white/86 px-4 py-3 text-xs font-medium leading-6 text-foreground/72 shadow-surface md:rounded-2xl md:text-sm">
            수동 편집 후 추천 시간, 라벨, AI 팁은 숨겨지고 이동 정보는 현재 순서 기준으로 다시 계산돼요
          </div>
        ) : null}
        {isEditMode && currentDay && onAddPlace ? (
          <div className="flex justify-end">
            <Button
              size="small"
              shape="pill"
              variant="secondary"
              className={compactActionButtonClassName}
              onClick={() => onAddPlace(currentDay.dayNumber)}
            >
              <Plus className="h-3.5 w-3.5" />
              장소 추가
            </Button>
          </div>
        ) : null}
      </div>
    );
  }, [currentDay, isCurrentDayEdited, isEditMode, onAddPlace]);

  const renderStopCard = useCallback(
    (stop: ScheduleStop, isActive: boolean) => (
      <RouteStopCard
        stop={stop}
        detailHref={currentDay?.date ? `/places/${stop.place.id}?visitDate=${encodeURIComponent(currentDay.date)}` : `/places/${stop.place.id}`}
        isActive={isActive}
        onFocus={focusStopFromCard}
        showMapAction={!isEditMode}
        showPlaceInfoAction={!isEditMode}
        showNoteActions={!isEditMode}
        isNoteOpen={!isEditMode && editingStopId === stop.id}
        isNoteSaving={!isEditMode && isStopNoteSaving && noteSavingStopId === stop.id}
        onToggleNote={
          !isEditMode && onToggleStopNote
            ? (stopId) => {
                focusStopFromCard(stopId);
                onToggleStopNote(stopId);
              }
            : undefined
        }
        onSaveNote={!isEditMode ? onSaveStopNote : undefined}
        editActions={isEditMode ? getStopEditActions?.(stop, currentDay as ScheduleDay) ?? null : null}
        hideGeneratedMeta={isCurrentDayEdited}
      />
    ),
    [
      currentDay,
      editingStopId,
      focusStopFromCard,
      getStopEditActions,
      isCurrentDayEdited,
      isEditMode,
      isStopNoteSaving,
      noteSavingStopId,
      onSaveStopNote,
      onToggleStopNote
    ]
  );

  const headerActions = (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-2 self-start">
      <RouteViewModeSliderToggle
        compactMobile
        iconOnly
        value={viewMode}
        onChange={setViewMode}
        splitLabel={UI_COPY.routes.detail.splitView}
        listLabel={UI_COPY.routes.detail.listView}
      />
      {isEditMode ? (
        <>
          <Button
            size="small"
            variant="secondary"
            className={`shrink-0 ${compactHeaderActionButtonClassName}`}
            onClick={onCancelEdit}
            disabled={editCommitBusy}
            aria-label="취소"
          >
            <X className="h-4 w-4" />
            <span className="hidden md:inline">취소</span>
          </Button>
          <Button
            size="small"
            className={`shrink-0 shadow-surface ${compactHeaderActionButtonClassName}`}
            onClick={onCommitEdit}
            disabled={editCommitBusy || editCommitDisabled}
            aria-label="저장"
          >
            {editCommitBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span className="hidden md:inline">저장</span>
          </Button>
        </>
      ) : (
        <>
          {onEnterEdit ? (
            <Button
              size="small"
              variant="secondary"
              className={`shrink-0 ${compactHeaderActionButtonClassName}`}
              onClick={onEnterEdit}
              aria-label="편집"
            >
              <PencilLine className="h-4 w-4" />
              <span className="hidden md:inline">편집</span>
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              size="small"
              variant="danger"
              className={`shrink-0 justify-center shadow-subtle ${compactHeaderActionButtonClassName}`}
              onClick={onDelete}
              disabled={deleteBusy}
              aria-label={UI_COPY.routes.detail.deleteAction}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden md:inline">{UI_COPY.routes.detail.deleteAction}</span>
            </Button>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <RouteSchedulePageShell
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      splitLabel={UI_COPY.routes.detail.splitView}
      listLabel={UI_COPY.routes.detail.listView}
      deleteButtonLabel={UI_COPY.routes.detail.deleteAction}
      deleteBusy={deleteBusy}
      onDelete={onDelete || (() => undefined)}
      deleteDialog={deleteDialog}
      headerActions={headerActions}
      baseClassName="pt-5"
      splitModeClassName="min-h-0 overflow-y-hidden pb-0 md:pb-0"
      listModeClassName="pb-4"
      headerLeading={
        <PageTitle
          title={schedule.title}
          subtitle={`${schedule.placeList.city} · ${formatDateRange(schedule.startDate, schedule.endDate)}`}
          className="min-w-0 flex-1"
          titleClassName="truncate"
        />
      }
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
          showTravelInfo={!isEditMode}
          topContent={dayTopContent}
        />
      }
      desktopStopList={
        <RouteStopList
          day={currentDay}
          activeStopId={activeStopId}
          refs={listRefs.desktopSplit}
          className="min-h-0 flex-1 overflow-y-auto"
          renderStopCard={renderStopCard}
          showTravelInfo={!isEditMode}
          topContent={dayTopContent}
        />
      }
      listModeStopList={
        <RouteStopList
          day={currentDay}
          activeStopId={activeStopId}
          refs={listRefs.list}
          className="flex-1 lg:min-h-0 lg:overflow-y-auto"
          renderStopCard={renderStopCard}
          showTravelInfo={!isEditMode}
          topContent={dayTopContent}
        />
      }
      mobileSplit={{
          points: currentDayPoints,
          activePointId: activeStopId,
          focusPointId: mapFocusRequest.pointId,
          focusPointRequestKey: mapFocusRequest.key,
          onPointClick: focusStopFromMap,
          fallbackUrl: routeMapUrl,
          showStayOverlay,
          stayMarker,
          stayRecommendation,
          mobileSheetMode,
          sheetDragOffset,
          isSheetDragging,
          onSheetPointerDown: handleSheetPointerDown,
          onSheetPointerMove: handleSheetPointerMove,
          onSheetPointerEnd: handleSheetPointerEnd,
          scrollRef: listRefs.mobile.scrollRef
        }}
        mobileMapOverlay={mobileMapOverlay}
        desktopMap={{
          points: currentDayPoints,
          activePointId: activeStopId,
          focusPointId: mapFocusRequest.pointId,
          focusPointRequestKey: mapFocusRequest.key,
          onPointClick: focusStopFromMap,
          fallbackUrl: routeMapUrl,
          showStayOverlay,
          stayMarker,
          stayRecommendation
        }}
        desktopMapOverlay={desktopMapOverlay}
      />
  );
}

