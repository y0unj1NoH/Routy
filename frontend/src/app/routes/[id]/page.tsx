"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading-panel";
import { PageContainer } from "@/components/layout/page-container";
import { RouteDetailView } from "@/components/routes/route-detail-view";
import { UI_COPY } from "@/constants/ui-copy";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { deleteSchedule, fetchScheduleDetail, updateScheduleStopNote } from "@/lib/graphql/api";
import { queryKeys } from "@/lib/query-keys";
import { useUiStore } from "@/stores/ui-store";
import type { Schedule } from "@/types/domain";

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
  const scheduleDays = useMemo(() => schedule?.days ?? [], [schedule?.days]);
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const currentStopExists = scheduleDays.some((day) => day.stops.some((stop) => stop.id === editingStopId));
    setEditingStopId((current) => (currentStopExists ? current : null));
  }, [editingStopId, scheduleDays]);

  const deleteMutation = useMutation({
    mutationFn: () => deleteSchedule(accessToken ?? "", id),
    onSuccess: () => {
      pushToast({ kind: "success", message: UI_COPY.routes.detail.toast.deleteSuccess });
      queryClient.invalidateQueries({ queryKey: queryKeys.mySchedules });
      router.replace("/");
    },
    onError: (error: Error) => {
      console.error(error);
      pushToast({ kind: "error", message: UI_COPY.routes.detail.toast.deleteError });
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
          isManualModified: true,
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

  const toggleStopNoteEditor = useCallback(
    (stopId: string) => {
      setEditingStopId((current) => (current === stopId ? null : stopId));
    },
    []
  );

  const saveStopNote = useCallback(
    (stopId: string, note: string | null) => {
      stopNoteMutation.mutate({ stopId, note });
    },
    [stopNoteMutation]
  );

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

  if (scheduleQuery.isError || !schedule) {
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

  return (
    <RouteDetailView
      schedule={schedule}
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
    />
  );
}
