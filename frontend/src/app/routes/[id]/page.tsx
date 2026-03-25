"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DialogFieldHint, DialogFieldLabel } from "@/components/common/dialog-field";
import { DialogShell } from "@/components/common/dialog-shell";
import { EmptyState } from "@/components/common/empty-state";
import { LinkInput } from "@/components/common/link-input";
import { LoadingPanel } from "@/components/common/loading-panel";
import { PageContainer } from "@/components/layout/page-container";
import { ToastCard } from "@/components/layout/toast-card";
import { RouteDetailView } from "@/components/routes/route-detail-view";
import { RoutePlacePickerDialog } from "@/components/routes/route-place-picker-dialog";
import { RouteStayMapControl, RouteStayRecommendationCallout } from "@/components/routes/route-stay-map-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UI_COPY } from "@/constants/ui-copy";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { captureAnalyticsEvent, getAnalyticsErrorCode } from "@/lib/analytics";
import { googleMapsUrlInputSchema } from "@/lib/forms/input-schemas";
import {
  addPlaceListItem,
  deleteSchedule,
  fetchScheduleDetail,
  importPlaceFromGoogleLink,
  saveScheduleEdits,
  updateScheduleStopNote
} from "@/lib/graphql/api";
import { buildTrackedErrorToastContent } from "@/lib/graphql/error-policy";
import { resolveImportErrorMessage } from "@/lib/graphql/import-errors";
import {
  addRouteEditGooglePlace,
  addRouteEditPlace,
  appendRouteEditPlaceListItem,
  buildSaveScheduleEditsInput,
  createDraftPlaceListItem,
  createRouteEditSession,
  deleteRouteEditStop,
  getPersistedEditedDayNumbers,
  hasRouteEditChanges,
  moveRouteEditStop,
  moveRouteEditStopToDay,
  restoreRouteEditStop,
  type PendingDeletedStop,
  type RouteEditSession
} from "@/lib/route-edit-session";
import { queryKeys } from "@/lib/query-keys";
import { getRouteStayMarker, getRouteStayOverlayMode, getRouteStayRecommendation } from "@/lib/route-stay";
import { useUiStore } from "@/stores/ui-store";
import type { Schedule, ScheduleStop } from "@/types/domain";

function compactDateMoveCount(placeCount: number) {
  return placeCount > 0 ? `${placeCount}개 장소` : "비어 있음";
}

type RouteEditAnalyticsSummary = {
  addedExistingPlaceCount: number;
  addedGooglePlaceCount: number;
  reorderedStopCount: number;
  movedDayCount: number;
  deletedStopCount: number;
  restoredStopCount: number;
};

function createEmptyRouteEditAnalyticsSummary(): RouteEditAnalyticsSummary {
  return {
    addedExistingPlaceCount: 0,
    addedGooglePlaceCount: 0,
    reorderedStopCount: 0,
    movedDayCount: 0,
    deletedStopCount: 0,
    restoredStopCount: 0
  };
}

function getChangedDayCount(baselineSchedule: Schedule, draftSchedule: Schedule) {
  const baselineDays = buildSaveScheduleEditsInput(baselineSchedule).days;
  const draftDays = buildSaveScheduleEditsInput(draftSchedule).days;

  return draftDays.reduce((count, draftDay, index) => {
    const baselineDay = baselineDays[index];
    return JSON.stringify(baselineDay?.stops ?? []) === JSON.stringify(draftDay.stops) ? count : count + 1;
  }, 0);
}

function buildRouteEditAnalyticsPayload(
  scheduleId: string,
  baselineSchedule: Schedule,
  draftSchedule: Schedule,
  summary: RouteEditAnalyticsSummary
) {
  return {
    schedule_id: scheduleId,
    changed_day_count: getChangedDayCount(baselineSchedule, draftSchedule),
    added_existing_place_count: summary.addedExistingPlaceCount,
    added_google_place_count: summary.addedGooglePlaceCount,
    reordered_stop_count: summary.reorderedStopCount,
    moved_day_count: summary.movedDayCount,
    deleted_stop_count: summary.deletedStopCount,
    restored_stop_count: summary.restoredStopCount
  };
}

export default function RouteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pushToast = useUiStore((state) => state.pushToast);
  const { session, isLoading: isAuthLoading, isAuthed } = useRequireAuth();
  const accessToken = session?.access_token;
  const id = params.id;

  const scheduleQuery = useQuery({
    queryKey: queryKeys.scheduleDetail(id),
    queryFn: () => fetchScheduleDetail(id, accessToken ?? ""),
    enabled: Boolean(accessToken && id)
  });

  const schedule = scheduleQuery.data;
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isStayOverlayVisible, setIsStayOverlayVisible] = useState(true);
  const [editSession, setEditSession] = useState<RouteEditSession | null>(null);
  const [pendingMoveStopId, setPendingMoveStopId] = useState<string | null>(null);
  const [pendingDeletedStops, setPendingDeletedStops] = useState<PendingDeletedStop[]>([]);
  const [isPlacePickerOpen, setIsPlacePickerOpen] = useState(false);
  const [placePickerDayNumber, setPlacePickerDayNumber] = useState<number | null>(null);
  const [isGooglePlaceDialogOpen, setIsGooglePlaceDialogOpen] = useState(false);
  const [googlePlaceDraftUrl, setGooglePlaceDraftUrl] = useState("");
  const editAnalyticsRef = useRef<RouteEditAnalyticsSummary>(createEmptyRouteEditAnalyticsSummary());

  const currentSchedule = editSession?.draftSchedule ?? schedule ?? null;
  const isEditMode = Boolean(editSession);
  const editedDayNumbers = useMemo(() => {
    if (editSession) {
      return editSession.workingEditedDayNumbers;
    }

    return schedule ? getPersistedEditedDayNumbers(schedule) : [];
  }, [editSession, schedule]);

  const scheduleDays = useMemo(() => currentSchedule?.days ?? [], [currentSchedule?.days]);
  const isEditDirty = useMemo(() => (editSession ? hasRouteEditChanges(editSession) : false), [editSession]);

  const stayMarker = useMemo(() => getRouteStayMarker(currentSchedule?.stayPlace ?? null), [currentSchedule?.stayPlace]);
  const stayRecommendation = useMemo(
    () => getRouteStayRecommendation(currentSchedule?.stayRecommendation ?? null),
    [currentSchedule?.stayRecommendation]
  );
  const stayOverlayMode = useMemo(
    () =>
      getRouteStayOverlayMode({
        stayPlace: currentSchedule?.stayPlace ?? null,
        stayRecommendation: currentSchedule?.stayRecommendation ?? null
      }),
    [currentSchedule?.stayPlace, currentSchedule?.stayRecommendation]
  );

  const usedPlaceIds = useMemo(
    () => new Set(scheduleDays.flatMap((day) => day.stops.map((stop) => stop.place.id))),
    [scheduleDays]
  );
  const availablePlaces = useMemo(
    () => currentSchedule?.placeList.items?.filter((item) => !usedPlaceIds.has(item.place.id)) ?? [],
    [currentSchedule?.placeList.items, usedPlaceIds]
  );

  const googlePlaceDraftValidation = useMemo(() => googleMapsUrlInputSchema.safeParse(googlePlaceDraftUrl), [googlePlaceDraftUrl]);
  const googlePlaceDraftError = useMemo(() => {
    const trimmedUrl = googlePlaceDraftUrl.trim();
    if (!trimmedUrl) return null;
    if (googlePlaceDraftValidation.success) return null;

    return googlePlaceDraftValidation.error.issues[0]?.message ?? UI_COPY.common.form.validUrl;
  }, [googlePlaceDraftUrl, googlePlaceDraftValidation]);

  const movingStop = useMemo(
    () => scheduleDays.flatMap((day) => day.stops).find((stop) => stop.id === pendingMoveStopId) ?? null,
    [pendingMoveStopId, scheduleDays]
  );
  const movingStopDayNumber = useMemo(
    () => scheduleDays.find((day) => day.stops.some((stop) => stop.id === pendingMoveStopId))?.dayNumber ?? null,
    [pendingMoveStopId, scheduleDays]
  );

  const clearEditTransientUi = useCallback(() => {
    setEditingStopId(null);
    setPendingMoveStopId(null);
    setPendingDeletedStops([]);
    setIsPlacePickerOpen(false);
    setPlacePickerDayNumber(null);
    setIsGooglePlaceDialogOpen(false);
    setGooglePlaceDraftUrl("");
  }, []);

  const resetEditAnalytics = useCallback(() => {
    editAnalyticsRef.current = createEmptyRouteEditAnalyticsSummary();
  }, []);

  const incrementEditAnalytics = useCallback((key: keyof RouteEditAnalyticsSummary) => {
    editAnalyticsRef.current = {
      ...editAnalyticsRef.current,
      [key]: editAnalyticsRef.current[key] + 1
    };
  }, []);

  useEffect(() => {
    const currentStopExists = scheduleDays.some((day) => day.stops.some((stop) => stop.id === editingStopId));
    setEditingStopId((current) => (currentStopExists ? current : null));
  }, [editingStopId, scheduleDays]);

  useEffect(() => {
    if (isEditMode) {
      setEditingStopId(null);
    }
  }, [isEditMode]);

  useEffect(() => {
    setIsStayOverlayVisible(true);
  }, [id, stayOverlayMode]);

  const deleteMutation = useMutation({
    mutationFn: () => deleteSchedule(accessToken ?? "", id),
    onSuccess: () => {
      pushToast({ kind: "success", message: UI_COPY.routes.detail.toast.deleteSuccess });
      queryClient.invalidateQueries({ queryKey: queryKeys.mySchedules });
      router.replace("/");
    },
    onError: (error: Error) => {
      console.error(error);
      pushToast({
        kind: "error",
        ...buildTrackedErrorToastContent("route_detail_delete", error, UI_COPY.routes.detail.toast.deleteError)
      });
    }
  });

  const stopNoteMutation = useMutation({
    mutationFn: ({ stopId, note }: { stopId: string; note: string | null }) =>
      updateScheduleStopNote(accessToken ?? "", id, { stopId, note }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.scheduleDetail(id) });
      const previous = queryClient.getQueryData<Schedule | null>(queryKeys.scheduleDetail(id));

      queryClient.setQueryData<Schedule | null>(queryKeys.scheduleDetail(id), (current) => {
        if (!current) return current;
        return {
          ...current,
          days: current.days.map((day) => ({
            ...day,
            stops: day.stops.map((stop) =>
              stop.id === variables.stopId
                ? {
                    ...stop,
                    note: variables.note,
                    isUserModified: true
                  }
                : stop
            )
          }))
        };
      });

      return { previous };
    },
    onSuccess: (_data, variables) => {
      setEditingStopId((current) => (current === variables.stopId ? null : current));
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.scheduleDetail(id), context.previous);
      }
      console.error(error);
      pushToast({ kind: "error", message: UI_COPY.routes.detail.toast.noteError });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleDetail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mySchedules });
    }
  });

  const saveEditMutation = useMutation({
    mutationFn: (draftSchedule: Schedule) => saveScheduleEdits(accessToken ?? "", id, buildSaveScheduleEditsInput(draftSchedule)),
    onSuccess: (updatedSchedule) => {
      captureAnalyticsEvent(
        "route_edit_saved",
        buildRouteEditAnalyticsPayload(
          id,
          schedule ?? updatedSchedule,
          editSession?.draftSchedule ?? updatedSchedule,
          editAnalyticsRef.current
        )
      );
      queryClient.setQueryData(queryKeys.scheduleDetail(id), updatedSchedule);
      setEditSession(null);
      resetEditAnalytics();
      clearEditTransientUi();
      pushToast({ kind: "success", message: "변경 내용을 저장했어요" });
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleDetail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mySchedules });
    },
    onError: (error: Error) => {
      console.error(error);
      pushToast({
        kind: "error",
        ...buildTrackedErrorToastContent("route_detail_save", error, "변경 내용을 저장하지 못했어요")
      });
    }
  });

  const googlePlaceMutation = useMutation({
    mutationFn: async ({
      targetDayNumber,
      url,
      scheduleSnapshot
    }: {
      targetDayNumber: number;
      url: string;
      scheduleSnapshot: Schedule;
    }) => {
      const importedPlaces = await importPlaceFromGoogleLink(accessToken ?? "", url);
      const importedPlace = importedPlaces[0] ?? null;

      if (!importedPlace) {
        throw new Error("Google 장소를 불러오지 못했어요");
      }

      const alreadyExistsInSchedule = scheduleSnapshot.days.some((day) =>
        day.stops.some((stop) => stop.place.id === importedPlace.id)
      );
      const alreadyExistsInList = (scheduleSnapshot.placeList.items || []).some((item) => item.place.id === importedPlace.id);
      if (alreadyExistsInSchedule || alreadyExistsInList) {
        throw new Error("이미 일정이나 저장 리스트에 있는 장소예요");
      }

      await addPlaceListItem(accessToken ?? "", {
        listId: scheduleSnapshot.placeList.id,
        placeId: importedPlace.id
      });

      return {
        importedPlace,
        listId: scheduleSnapshot.placeList.id,
        targetDayNumber
      };
    },
    onSuccess: ({ importedPlace, listId, targetDayNumber }) => {
      incrementEditAnalytics("addedGooglePlaceCount");
      captureAnalyticsEvent("google_place_import_succeeded", {
        source: "route_detail_edit",
        imported_count: 1
      });
      const importedItem = createDraftPlaceListItem(importedPlace);

      queryClient.setQueryData<Schedule | null>(queryKeys.scheduleDetail(id), (current) => {
        if (!current) return current;
        return appendRouteEditPlaceListItem(current, importedItem);
      });
      setEditSession((current) => (current ? addRouteEditGooglePlace(current, importedItem, targetDayNumber) : current));
      setGooglePlaceDraftUrl("");
      setIsGooglePlaceDialogOpen(false);
      setPlacePickerDayNumber(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleDetail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.placeListDetail(listId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myPlaceLists });
    },
    onError: (error: Error) => {
      console.error(error);
      captureAnalyticsEvent("google_place_import_failed", {
        source: "route_detail_edit",
        error_code: getAnalyticsErrorCode(error)
      });
      if (error.message === "이미 일정이나 저장 리스트에 있는 장소예요") {
        pushToast({ kind: "info", message: error.message });
        return;
      }
      const message = resolveImportErrorMessage(error, "Google 장소를 추가하지 못했어요");
      pushToast({
        kind: "error",
        ...buildTrackedErrorToastContent("route_detail_add_google_place", error, "Google 장소를 추가하지 못했어요", message)
      });
    }
  });

  const toggleStopNoteEditor = useCallback((stopId: string) => {
    setEditingStopId((current) => (current === stopId ? null : stopId));
  }, []);

  const saveStopNote = useCallback(
    (stopId: string, note: string | null) => {
      stopNoteMutation.mutate({ stopId, note });
    },
    [stopNoteMutation]
  );

  const openPlacePicker = useCallback((dayNumber: number) => {
    setPlacePickerDayNumber(dayNumber);
    setIsPlacePickerOpen(true);
  }, []);

  const handleDeleteStop = useCallback((stop: ScheduleStop, dayNumber: number, stopIndex: number) => {
    incrementEditAnalytics("deletedStopCount");
    setEditSession((current) => (current ? deleteRouteEditStop(current, stop.id) : current));
    setPendingDeletedStops((current) => [
      { stop, dayNumber, stopIndex },
      ...current.filter((item) => item.stop.id !== stop.id)
    ]);
  }, [incrementEditAnalytics]);

  if (isAuthLoading || !isAuthed) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.common.loading.authCheck} />
      </PageContainer>
    );
  }

  if (scheduleQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.routes.detail.loading} />
      </PageContainer>
    );
  }

  if (scheduleQuery.isError || !schedule || !currentSchedule) {
    return (
      <PageContainer>
        <EmptyState
          title={UI_COPY.routes.detail.notFoundTitle}
          description={UI_COPY.routes.detail.notFoundDescription}
          mascotVariant="surprise"
        />
      </PageContainer>
    );
  }

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

  return (
    <>
      <RouteDetailView
        schedule={currentSchedule}
        onBack={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
          }
          router.replace("/");
        }}
        onDelete={() => setIsDeleteDialogOpen(true)}
        deleteBusy={deleteMutation.isPending}
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
        editingStopId={editingStopId}
        isStopNoteSaving={stopNoteMutation.isPending}
        noteSavingStopId={stopNoteMutation.variables?.stopId ?? null}
        onToggleStopNote={toggleStopNoteEditor}
        onSaveStopNote={saveStopNote}
        isEditMode={isEditMode}
        onEnterEdit={() => {
          resetEditAnalytics();
          captureAnalyticsEvent("route_edit_started", {
            schedule_id: id,
            day_count: schedule.dayCount
          });
          setEditSession(createRouteEditSession(schedule));
          clearEditTransientUi();
        }}
        onCancelEdit={() => {
          if (editSession) {
            captureAnalyticsEvent("route_edit_cancelled", {
              ...buildRouteEditAnalyticsPayload(id, schedule, editSession.draftSchedule, editAnalyticsRef.current),
              had_changes: isEditDirty
            });
          }
          setEditSession(null);
          resetEditAnalytics();
          clearEditTransientUi();
        }}
        onCommitEdit={() => {
          if (!editSession) return;
          if (!isEditDirty) {
            setEditSession(null);
            clearEditTransientUi();
            return;
          }
          saveEditMutation.mutate(editSession.draftSchedule);
        }}
        editCommitBusy={saveEditMutation.isPending}
        editCommitDisabled={!isEditDirty}
        editedDayNumbers={editedDayNumbers}
        onAddPlace={openPlacePicker}
        getStopEditActions={(stop, day) => ({
          onMoveUp: () => {
            incrementEditAnalytics("reorderedStopCount");
            setEditSession((current) => (current ? moveRouteEditStop(current, stop.id, "up") : current));
          },
          onMoveDown: () => {
            incrementEditAnalytics("reorderedStopCount");
            setEditSession((current) => (current ? moveRouteEditStop(current, stop.id, "down") : current));
          },
          onMoveDay: () => setPendingMoveStopId(stop.id),
          onDelete: () => {
            const stopIndex = day.stops.findIndex((dayStop) => dayStop.id === stop.id);
            if (stopIndex < 0) return;
            handleDeleteStop(stop, day.dayNumber, stopIndex);
          },
          moveUpDisabled: day.stops[0]?.id === stop.id,
          moveDownDisabled: day.stops[day.stops.length - 1]?.id === stop.id
        })}
        mobileMapOverlay={stayMapOverlay}
        desktopMapOverlay={stayMapOverlay}
        showStayOverlay={isStayOverlayVisible}
        stayMarker={stayMarker}
        stayRecommendation={stayRecommendation}
      />

      <RoutePlacePickerDialog
        open={isPlacePickerOpen}
        availablePlaces={availablePlaces}
        selectedDayNumber={placePickerDayNumber}
        canAddGooglePlace
        onClose={() => {
          setIsPlacePickerOpen(false);
          setPlacePickerDayNumber(null);
        }}
        onSelectPlace={(item) => {
          const targetDayNumber = placePickerDayNumber;
          if (!targetDayNumber) return;

          incrementEditAnalytics("addedExistingPlaceCount");
          setEditSession((current) => (current ? addRouteEditPlace(current, item, targetDayNumber) : current));
          setIsPlacePickerOpen(false);
          setPlacePickerDayNumber(null);
        }}
        onStartGooglePlaceAdd={() => {
          setIsPlacePickerOpen(false);
          setGooglePlaceDraftUrl("");
          setIsGooglePlaceDialogOpen(true);
        }}
      />

      <DialogShell
        open={isGooglePlaceDialogOpen}
        onClose={() => {
          setIsGooglePlaceDialogOpen(false);
          setGooglePlaceDraftUrl("");
          if (placePickerDayNumber) {
            setIsPlacePickerOpen(true);
          }
        }}
        title={placePickerDayNumber ? `${placePickerDayNumber}일차에 Google 장소 추가` : "Google 장소 추가"}
        description="장소를 추가하면 일정과 리스트에 모두 추가돼요"
        mascotVariant={null}
        headerClassName="bg-[linear-gradient(135deg,rgba(232,244,255,0.94),rgba(255,255,255,1)_72%)]"
        showCloseButton={false}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="medium"
              className="min-w-[88px]"
              onClick={() => {
                setIsGooglePlaceDialogOpen(false);
                setGooglePlaceDraftUrl("");
                if (placePickerDayNumber) {
                  setIsPlacePickerOpen(true);
                }
              }}
              disabled={googlePlaceMutation.isPending}
            >
              취소
            </Button>
            <Button
              size="medium"
              className="min-w-[116px]"
              onClick={() => {
                if (!placePickerDayNumber || !googlePlaceDraftValidation.success || !currentSchedule) return;
                captureAnalyticsEvent("google_place_import_started", {
                  source: "route_detail_edit"
                });
                googlePlaceMutation.mutate({
                  targetDayNumber: placePickerDayNumber,
                  url: googlePlaceDraftValidation.data,
                  scheduleSnapshot: currentSchedule
                });
              }}
              disabled={!placePickerDayNumber || !googlePlaceDraftValidation.success || googlePlaceMutation.isPending}
            >
              일정에 추가
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <DialogFieldLabel htmlFor="route-detail-google-place-url" required>
              Google Maps 링크
            </DialogFieldLabel>
            <LinkInput
              id="route-detail-google-place-url"
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              value={googlePlaceDraftUrl}
              onChange={(event) => setGooglePlaceDraftUrl(event.target.value)}
              placeholder="https://maps.google.com/..."
              aria-invalid={Boolean(googlePlaceDraftError)}
              className={googlePlaceDraftError ? "border-danger/45 focus-visible:border-danger focus-visible:ring-danger/15" : undefined}
            />
            {googlePlaceDraftError ? <DialogFieldHint error>{googlePlaceDraftError}</DialogFieldHint> : null}
          </div>

          {googlePlaceDraftValidation.success ? (
            <Card className="rounded-[22px] border-border/75 bg-white/94 p-4 shadow-subtle">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary-soft/85 p-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-primary-hover">추가 준비 완료</p>
                  <p className="text-sm font-black tracking-tight text-foreground">링크를 확인했어요</p>
                  <p className="text-xs leading-5 text-foreground/58">일정과 저장 리스트에 함께 반영돼요</p>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </DialogShell>

      <DialogShell
        open={Boolean(movingStop)}
        onClose={() => setPendingMoveStopId(null)}
        title="어느 날짜로 옮길까요?"
        description="선택한 날짜 마지막에 추가돼요"
        mascotVariant={null}
        headerClassName="bg-[linear-gradient(135deg,rgba(232,244,255,0.94),rgba(255,255,255,1)_72%)]"
        showCloseButton={false}
        size="md"
        footer={
          <Button variant="secondary" size="small" className="min-w-[88px]" onClick={() => setPendingMoveStopId(null)}>
            취소
          </Button>
        }
      >
        <div className="space-y-3">
          {scheduleDays.map((day) => {
            const disabled = !movingStop || day.dayNumber === movingStopDayNumber;

            return (
              <button
                key={day.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (!movingStop) return;
                  incrementEditAnalytics("movedDayCount");
                  setEditSession((current) => (current ? moveRouteEditStopToDay(current, movingStop.id, day.dayNumber) : current));
                  setPendingMoveStopId(null);
                }}
                className="flex w-full items-center justify-between rounded-[22px] border border-border/80 bg-white px-4 py-3 text-left text-sm font-semibold text-foreground shadow-[0_12px_24px_rgba(15,23,42,0.05)] transition hover:border-primary-light/65 hover:bg-primary-soft/25 disabled:pointer-events-none disabled:opacity-55"
              >
                <span>{day.dayNumber}일차</span>
                <span className="text-xs font-medium text-foreground/55">{compactDateMoveCount(day.stops.length)}</span>
              </button>
            );
          })}
        </div>
      </DialogShell>

      {pendingDeletedStops.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-4">
          {pendingDeletedStops.map((item) => (
            <ToastCard
              key={item.stop.id}
              kind="success"
              role="status"
              className="pointer-events-auto w-full max-w-[340px]"
              message={`${item.stop.place.name || UI_COPY.routes.stopCard.placeFallback}을 일정에서 뺐어요`}
              action={
                <button
                  type="button"
                  onClick={() => {
                    incrementEditAnalytics("restoredStopCount");
                    setEditSession((current) => (current ? restoreRouteEditStop(current, item) : current));
                    setPendingDeletedStops((current) => current.filter((currentItem) => currentItem.stop.id !== item.stop.id));
                  }}
                  className="inline-flex h-7 shrink-0 items-center justify-center rounded-full border border-primary-light/34 bg-white/78 px-3 text-xs font-semibold text-primary-hover transition-colors hover:bg-white hover:text-primary md:h-8 md:px-3.5"
                >
                  {UI_COPY.common.action.restore}
                </button>
              }
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
