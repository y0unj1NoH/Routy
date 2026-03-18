"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DialogFieldHint, DialogFieldLabel } from "@/components/common/dialog-field";
import { DialogShell } from "@/components/common/dialog-shell";
import { EmptyState } from "@/components/common/empty-state";
import { LinkInput } from "@/components/common/link-input";
import { LoadingPanel } from "@/components/common/loading-panel";
import { PageContainer } from "@/components/layout/page-container";
import { ToastCard } from "@/components/layout/toast-card";
import { SavedListPlaceCard } from "@/components/saved/saved-list-place-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UI_COPY } from "@/constants/ui-copy";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { cn } from "@/lib/cn";
import {
  googleMapsImportFormSchema,
  PLACE_LIST_CITY_MAX_LENGTH,
  PLACE_LIST_NAME_MAX_LENGTH,
  placeListCityInputSchema,
  placeListNameInputSchema
} from "@/lib/forms/input-schemas";
import { safeZodResolver } from "@/lib/forms/safe-zod-resolver";
import {
  addPlaceListItem,
  deletePlaceList,
  fetchPlaceListDetail,
  importPlaceFromGoogleLink,
  removePlaceListItem,
  updatePlaceList,
  updatePlaceListItem
} from "@/lib/graphql/api";
import { queryKeys } from "@/lib/query-keys";
import { useUiStore } from "@/stores/ui-store";
import type { PlaceList, PlaceListItem } from "@/types/domain";

type GoogleLinkFormValues = z.infer<typeof googleMapsImportFormSchema>;
const PLACE_REMOVE_UNDO_MS = 5000;

function countCharacters(value: string) {
  return Array.from(value).length;
}

type HeaderInlineCounterInputProps = ComponentProps<typeof Input> & {
  maxCount: number;
  wrapperClassName?: string;
  counterClassName?: string;
};

function HeaderInlineCounterInput({
  value,
  maxCount,
  className,
  wrapperClassName,
  counterClassName,
  ...props
}: HeaderInlineCounterInputProps) {
  const currentCount = countCharacters(String(value ?? ""));

  return (
    <div className={cn("relative min-w-0", wrapperClassName)}>
      <Input {...props} value={value} className={cn(className, "pr-14 md:pr-16")} />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-0 tabular-nums text-2xs font-semibold text-foreground/38 md:text-xs",
          counterClassName
        )}
      >
        {currentCount}/{maxCount}
      </span>
    </div>
  );
}

export default function SavedListDetailPage() {
  const addPlaceFormId = useId();
  const addPlaceUrlFieldId = `${addPlaceFormId}-google-url`;
  const params = useParams<{ listId: string }>();
  const router = useRouter();
  const listId = params.listId;
  const queryClient = useQueryClient();
  const detailQueryKey = queryKeys.placeListDetail(listId);
  const pushToast = useUiStore((state) => state.pushToast);
  const [isAddPlaceModalOpen, setIsAddPlaceModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isHeaderEditing, setIsHeaderEditing] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({
    name: "",
    city: ""
  });
  const [listFieldErrors, setListFieldErrors] = useState<{ name?: string; city?: string }>({});
  const [pendingRemovalItemIds, setPendingRemovalItemIds] = useState<string[]>([]);
  const [prioritySavingItemIds, setPrioritySavingItemIds] = useState<string[]>([]);
  const pendingRemovalTimersRef = useRef<Record<string, number>>({});
  const priorityRequestInFlightRef = useRef<Record<string, boolean>>({});
  const priorityQueuedValueRef = useRef<Record<string, boolean | undefined>>({});
  const addPlaceForm = useForm<GoogleLinkFormValues>({
    resolver: safeZodResolver(googleMapsImportFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      googleUrl: ""
    }
  });
  const googleLinkInput = addPlaceForm.watch("googleUrl");
  const compactHeaderActionButtonClassName = "w-9 gap-0 px-0 md:w-auto md:gap-1.5 md:px-3.5";
  const closeAddPlaceModal = () => {
    addPlaceForm.clearErrors();
    setIsAddPlaceModalOpen(false);
  };

  const { session, isLoading: isAuthLoading, isAuthed } = useRequireAuth();
  const accessToken = session?.access_token;

  const detailQuery = useQuery({
    queryKey: detailQueryKey,
    queryFn: () => fetchPlaceListDetail(listId, accessToken ?? ""),
    enabled: Boolean(accessToken && listId)
  });

  const listUpdateMutation = useMutation({
    mutationFn: (input: { name?: string; city?: string }) => updatePlaceList(accessToken ?? "", listId, input),
    onSuccess: (updatedList) => {
      queryClient.setQueryData<PlaceList | null>(detailQueryKey, (current) => {
        if (!current) {
          return updatedList;
        }

        return {
          ...current,
          ...updatedList,
          items: updatedList.items ?? current.items
        };
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.myPlaceLists });
      setListFieldErrors({});
      setHeaderDraft({
        name: updatedList.name,
        city: updatedList.city
      });
      setIsHeaderEditing(false);
      pushToast({ kind: "success", message: UI_COPY.saved.detail.updateSuccess });
    },
    onError: (error: Error) => {
      console.error(error);
      pushToast({ kind: "error", message: UI_COPY.saved.detail.updateError });
    }
  });

  const noteMutation = useMutation({
    mutationFn: async (input: { itemId: string; note?: string | null }) => {
      await updatePlaceListItem(accessToken ?? "", input.itemId, {
        note: input.note
      });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: detailQueryKey });
      const previous = queryClient.getQueryData<PlaceList | null>(detailQueryKey);

      queryClient.setQueryData<PlaceList | null>(detailQueryKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) =>
            item.id === input.itemId
              ? {
                  ...item,
                  note: input.note ?? null
                }
              : item
          )
        };
      });

      return { previous };
    },
    onError: (error: Error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailQueryKey, context.previous);
      }
      console.error(error);
      pushToast({ kind: "error", message: UI_COPY.saved.detail.noteError });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: detailQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.myPlaceLists });
    }
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => removePlaceListItem(accessToken ?? "", itemId),
    onSuccess: (_result, itemId) => {
      queryClient.setQueryData<PlaceList | null>(detailQueryKey, (current) => {
        if (!current) return current;
        const nextItems = current.items.filter((item) => item.id !== itemId);
        return {
          ...current,
          itemCount: nextItems.length,
          items: nextItems
        };
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.myPlaceLists });
      setPendingRemovalItemIds((current) => current.filter((currentItemId) => currentItemId !== itemId));
    },
    onError: (error: Error, itemId) => {
      setPendingRemovalItemIds((current) => current.filter((currentItemId) => currentItemId !== itemId));
      console.error(error);
      pushToast({ kind: "error", message: UI_COPY.saved.detail.removePlaceError });
    }
  });

  const updatePriorityInCache = (itemId: string, isMustVisit: boolean) => {
    queryClient.setQueryData<PlaceList | null>(detailQueryKey, (current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                isMustVisit
              }
            : item
        )
      };
    });
  };

  const setPrioritySaving = (itemId: string, isSaving: boolean) => {
    setPrioritySavingItemIds((current) => {
      if (isSaving) {
        return current.includes(itemId) ? current : [...current, itemId];
      }
      return current.filter((currentItemId) => currentItemId !== itemId);
    });
  };

  const flushPriorityUpdate = async (itemId: string, initialConfirmedPriority: boolean) => {
    if (priorityRequestInFlightRef.current[itemId]) return;

    priorityRequestInFlightRef.current[itemId] = true;
    setPrioritySaving(itemId, true);
    let lastConfirmedPriority = initialConfirmedPriority;

    try {
      while (Object.prototype.hasOwnProperty.call(priorityQueuedValueRef.current, itemId)) {
        const nextPriority = Boolean(priorityQueuedValueRef.current[itemId]);
        delete priorityQueuedValueRef.current[itemId];
        await updatePlaceListItem(accessToken ?? "", itemId, { isMustVisit: nextPriority });
        lastConfirmedPriority = nextPriority;
      }
    } catch (error) {
      delete priorityQueuedValueRef.current[itemId];
      updatePriorityInCache(itemId, lastConfirmedPriority);
      console.error(error);
      pushToast({ kind: "error", message: UI_COPY.saved.detail.mustVisitError });
    } finally {
      delete priorityRequestInFlightRef.current[itemId];
      setPrioritySaving(itemId, false);
      queryClient.invalidateQueries({ queryKey: detailQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.myPlaceLists });
    }
  };

  const handleTogglePriority = (currentItem: PlaceListItem) => {
    const latestPriority =
      queryClient.getQueryData<PlaceList | null>(detailQueryKey)?.items.find((item) => item.id === currentItem.id)?.isMustVisit ??
      currentItem.isMustVisit;
    const nextPriority = !latestPriority;
    updatePriorityInCache(currentItem.id, nextPriority);
    priorityQueuedValueRef.current[currentItem.id] = nextPriority;
    void flushPriorityUpdate(currentItem.id, latestPriority);
  };

  const deleteListMutation = useMutation({
    mutationFn: () => deletePlaceList(accessToken ?? "", listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myPlaceLists });
      pushToast({ kind: "success", message: UI_COPY.saved.detail.deleteSuccess });
      router.replace("/saved");
    },
    onError: (error: Error) => {
      console.error(error);
      pushToast({ kind: "error", message: UI_COPY.saved.detail.deleteError });
    }
  });

  const addPlaceByLinkMutation = useMutation({
    mutationFn: async (url: string) => {
      const places = await importPlaceFromGoogleLink(accessToken ?? "", url);
      if (!places || places.length === 0) {
        throw new Error(UI_COPY.saved.detail.addPlaceNotFound);
      }

      await Promise.all(
        places.map((place) =>
          addPlaceListItem(accessToken ?? "", {
            listId,
            placeId: place.id,
            note: null,
            isMustVisit: false
          })
        )
      );

      return {
        importedCount: places.length,
        primaryPlaceName: places[0]?.name || UI_COPY.saved.detail.placesSection.placeFallback
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: detailQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.myPlaceLists });
      addPlaceForm.reset();
      closeAddPlaceModal();
      pushToast({
        kind: "success",
        message: UI_COPY.saved.detail.addPlaceSuccess(result.importedCount, result.primaryPlaceName)
      });
    },
    onError: (error: Error) => {
      console.error(error);
      const message = error.message === UI_COPY.saved.detail.addPlaceNotFound ? error.message : UI_COPY.saved.detail.addPlaceError;
      addPlaceForm.setError("root", { type: "server", message });
      pushToast({ kind: "error", message });
    }
  });

  const onSubmitAddPlaceByLink = addPlaceForm.handleSubmit((values) => {
    addPlaceForm.clearErrors("root");
    addPlaceByLinkMutation.mutate(values.googleUrl.trim());
  });

  useEffect(() => {
    return () => {
      Object.values(pendingRemovalTimersRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      pendingRemovalTimersRef.current = {};
    };
  }, []);

  if (isAuthLoading || !isAuthed) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.common.loading.authCheck} />
      </PageContainer>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.saved.detail.loading} />
      </PageContainer>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <PageContainer>
        <EmptyState
          title={UI_COPY.saved.detail.notFoundTitle}
          description={UI_COPY.saved.detail.notFoundDescription}
          mascotVariant="surprise"
        />
      </PageContainer>
    );
  }

  const list = detailQuery.data;
  const pendingRemovalSet = new Set(pendingRemovalItemIds);
  const visibleItems = list.items.filter((item) => !pendingRemovalSet.has(item.id));
  const visibleItemCount = visibleItems.length;

  const clearListFieldError = (field: "name" | "city") => {
    setListFieldErrors((current) => {
      if (!current[field]) return current;
      return {
        ...current,
        [field]: undefined
      };
    });
  };

  const validateListField = (field: "name" | "city", rawValue: string) => {
    const schema = field === "name" ? placeListNameInputSchema : placeListCityInputSchema;
    const result = schema.safeParse(rawValue);

    if (!result.success) {
      setListFieldErrors((current) => ({
        ...current,
        [field]: result.error.issues[0]?.message || UI_COPY.common.error.invalidInput
      }));
      return null;
    }

    clearListFieldError(field);
    return result.data;
  };

  const startHeaderEditing = () => {
    setHeaderDraft({
      name: list.name,
      city: list.city
    });
    setListFieldErrors({});
    setIsHeaderEditing(true);
  };

  const cancelHeaderEditing = () => {
    setHeaderDraft({
      name: list.name,
      city: list.city
    });
    setListFieldErrors({});
    setIsHeaderEditing(false);
  };

  const saveHeader = () => {
    const nextName = validateListField("name", headerDraft.name);
    const nextCity = validateListField("city", headerDraft.city);
    if (!nextName || !nextCity) return;

    const updates: { name?: string; city?: string } = {};

    if (nextName !== list.name) {
      updates.name = nextName;
    }

    if (nextCity !== list.city) {
      updates.city = nextCity;
    }

    setHeaderDraft({
      name: nextName,
      city: nextCity
    });

    if (Object.keys(updates).length === 0) {
      setIsHeaderEditing(false);
      return;
    }

    listUpdateMutation.mutate(updates);
  };

  const queueItemRemoval = (item: PlaceListItem) => {
    if (pendingRemovalSet.has(item.id)) return;

    if (pendingRemovalTimersRef.current[item.id]) {
      window.clearTimeout(pendingRemovalTimersRef.current[item.id]);
    }

    setPendingRemovalItemIds((current) => [item.id, ...current.filter((currentItemId) => currentItemId !== item.id)]);
    pendingRemovalTimersRef.current[item.id] = window.setTimeout(() => {
      delete pendingRemovalTimersRef.current[item.id];
      removeItemMutation.mutate(item.id);
    }, PLACE_REMOVE_UNDO_MS);
  };

  const undoQueuedRemoval = (itemId: string) => {
    if (pendingRemovalTimersRef.current[itemId]) {
      window.clearTimeout(pendingRemovalTimersRef.current[itemId]);
      delete pendingRemovalTimersRef.current[itemId];
    }

    setPendingRemovalItemIds((current) => current.filter((currentItemId) => currentItemId !== itemId));
  };

  return (
    <PageContainer className="space-y-[var(--page-section-gap)] pb-[calc(11rem+env(safe-area-inset-bottom))]">
      <div className="space-y-[var(--page-block-gap)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className={`min-w-0 ${isHeaderEditing ? "space-y-3" : "space-y-1.5"}`}>
              {isHeaderEditing ? (
                <>
                  <div className="space-y-0">
                    <HeaderInlineCounterInput
                      value={headerDraft.name}
                      onChange={(event) => {
                        clearListFieldError("name");
                        setHeaderDraft((current) => ({
                          ...current,
                          name: event.target.value
                        }));
                      }}
                      maxCount={PLACE_LIST_NAME_MAX_LENGTH}
                      maxLength={PLACE_LIST_NAME_MAX_LENGTH}
                      placeholder={list.name}
                      className="h-auto rounded-none border-0 border-b border-border/70 bg-transparent px-0 py-2 font-black leading-[1.2] tracking-[-0.03em] text-foreground shadow-none focus-visible:ring-0"
                      counterClassName="bottom-2 md:bottom-2.5"
                      style={{ fontSize: "var(--page-title-size)" }}
                      aria-label="리스트 이름"
                      aria-invalid={Boolean(listFieldErrors.name)}
                    />
                    <p className="text-xs text-danger">{listFieldErrors.name}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <HeaderInlineCounterInput
                        value={headerDraft.city}
                        onChange={(event) => {
                          clearListFieldError("city");
                          setHeaderDraft((current) => ({
                            ...current,
                            city: event.target.value
                          }));
                        }}
                        maxCount={PLACE_LIST_CITY_MAX_LENGTH}
                        maxLength={PLACE_LIST_CITY_MAX_LENGTH}
                        placeholder={list.city}
                        wrapperClassName="min-w-[7rem] max-w-xs flex-1"
                        className="h-auto w-full rounded-none border-0 border-b border-border/70 bg-transparent px-0 py-1 font-medium leading-[1.5] text-foreground shadow-none focus-visible:ring-0"
                        counterClassName="bottom-1.5 md:bottom-2"
                        style={{ fontSize: "var(--page-subtitle-size)" }}
                        aria-label="도시"
                        aria-invalid={Boolean(listFieldErrors.city)}
                      />
                      <span
                        className="font-medium leading-[1.5] text-foreground/52"
                        style={{ fontSize: "var(--page-subtitle-size)" }}
                      >
                        {visibleItemCount}개 장소
                      </span>
                    </div>
                    <p className="text-xs text-danger">{listFieldErrors.city}</p>
                  </div>
                </>
              ) : (
                <>
                  <h1
                    className="truncate break-keep font-black leading-[1.2] tracking-[-0.03em] text-foreground"
                    style={{ fontSize: "var(--page-title-size)" }}
                  >
                    {list.name}
                  </h1>
                  <div
                    className="flex flex-wrap items-center gap-2 font-medium leading-[1.5] text-foreground/58"
                    style={{ fontSize: "var(--page-subtitle-size)" }}
                  >
                    <span className="font-semibold text-foreground/72">{list.city}</span>
                    <span className="h-1 w-1 rounded-full bg-foreground/20" />
                    <span>{visibleItemCount}개 장소</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isHeaderEditing ? (
              <>
                <Button
                  variant="secondary"
                  size="small"
                  shape="pill"
                  className={compactHeaderActionButtonClassName}
                  aria-label={UI_COPY.common.action.cancel}
                  title={UI_COPY.common.action.cancel}
                  disabled={listUpdateMutation.isPending}
                  onClick={cancelHeaderEditing}
                >
                  <X className="h-4 w-4" />
                  <span className="hidden md:inline">{UI_COPY.common.action.cancel}</span>
                </Button>
                <Button
                  size="small"
                  shape="pill"
                  className={`shadow-surface ${compactHeaderActionButtonClassName}`}
                  aria-label={
                    listUpdateMutation.isPending ? UI_COPY.saved.detail.headerEditor.saving : UI_COPY.saved.detail.headerEditor.save
                  }
                  title={
                    listUpdateMutation.isPending ? UI_COPY.saved.detail.headerEditor.saving : UI_COPY.saved.detail.headerEditor.save
                  }
                  disabled={listUpdateMutation.isPending}
                  onClick={saveHeader}
                >
                  <Check className="h-4 w-4" />
                  <span className="hidden md:inline">
                    {listUpdateMutation.isPending ? UI_COPY.saved.detail.headerEditor.saving : UI_COPY.saved.detail.headerEditor.save}
                  </span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="small"
                  variant="secondary"
                  shape="pill"
                  className={compactHeaderActionButtonClassName}
                  aria-label={UI_COPY.saved.detail.headerActions.editList}
                  title={UI_COPY.saved.detail.headerActions.editList}
                  onClick={startHeaderEditing}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="hidden md:inline">{UI_COPY.saved.detail.headerActions.editList}</span>
                </Button>
                <Button
                  size="small"
                  variant="danger"
                  shape="pill"
                  className={`shadow-subtle ${compactHeaderActionButtonClassName}`}
                  aria-label={UI_COPY.saved.detail.headerActions.deleteList}
                  title={UI_COPY.saved.detail.headerActions.deleteList}
                  disabled={deleteListMutation.isPending}
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden md:inline">{UI_COPY.saved.detail.headerActions.deleteList}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex justify-end">
          <Button size="small" onClick={() => setIsAddPlaceModalOpen(true)}>
            <Plus className="h-4 w-4" /> {UI_COPY.saved.detail.headerActions.addPlace}
          </Button>
        </div>

        <div className="grid gap-3">
          {visibleItems.length === 0 ? (
            <EmptyState
              title={UI_COPY.saved.detail.placesSection.emptyTitle}
              description={UI_COPY.saved.detail.placesSection.emptyDescription}
            />
          ) : (
            visibleItems.map((item) => (
              <SavedListPlaceCard
                key={item.id}
                item={item}
                detailHref={`/saved/${listId}/${item.place.id}`}
                variant="comparison"
                isNoteSaving={noteMutation.isPending && noteMutation.variables?.itemId === item.id}
                isPrioritySaving={prioritySavingItemIds.includes(item.id)}
                onTogglePriority={handleTogglePriority}
                onRemove={queueItemRemoval}
                onSaveNote={(itemId, note) => {
                  noteMutation.mutate({
                    itemId,
                    note
                  });
                }}
              />
            ))
          )}
        </div>
      </section>

      <DialogShell
        open={isAddPlaceModalOpen}
        eyebrow="Add Place"
        title={UI_COPY.saved.detail.addPlaceModal.title}
        busy={addPlaceByLinkMutation.isPending}
        mascotVariant={null}
        showCloseButton={false}
        headerClassName="bg-[linear-gradient(135deg,rgba(232,244,255,0.94),rgba(255,255,255,1)_72%)]"
        size="lg"
        onClose={closeAddPlaceModal}
        footer={
          <>
            <Button
              variant="secondary"
              size="medium"
              onClick={() => {
                if (addPlaceByLinkMutation.isPending) return;
                closeAddPlaceModal();
              }}
            >
              {UI_COPY.common.action.cancel}
            </Button>
            <Button
              type="submit"
              form={addPlaceFormId}
              size="medium"
              disabled={addPlaceByLinkMutation.isPending || !googleLinkInput.trim()}
            >
              {addPlaceByLinkMutation.isPending ? UI_COPY.saved.detail.addPlaceModal.submitting : UI_COPY.saved.detail.addPlaceModal.submit}
            </Button>
          </>
        }
      >
        <form id={addPlaceFormId} noValidate onSubmit={onSubmitAddPlaceByLink} className="space-y-4">
          {addPlaceForm.formState.errors.root?.message ? (
            <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {addPlaceForm.formState.errors.root.message}
            </p>
          ) : null}

          <div className="space-y-1">
            <DialogFieldLabel htmlFor={addPlaceUrlFieldId} required>
              {UI_COPY.saved.detail.addPlaceModal.label}
            </DialogFieldLabel>
            <LinkInput
              id={addPlaceUrlFieldId}
              type="url"
              inputMode="url"
              placeholder={UI_COPY.saved.detail.addPlaceModal.placeholder}
              aria-invalid={Boolean(addPlaceForm.formState.errors.googleUrl)}
              {...addPlaceForm.register("googleUrl")}
            />
            <DialogFieldHint error>{addPlaceForm.formState.errors.googleUrl?.message}</DialogFieldHint>
          </div>
        </form>
      </DialogShell>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        title={UI_COPY.common.deleteConfirm.title}
        description={UI_COPY.common.deleteConfirm.description}
        confirmLabel={
          deleteListMutation.isPending ? UI_COPY.common.deleteConfirm.confirming : UI_COPY.common.deleteConfirm.confirm
        }
        cancelLabel={UI_COPY.common.deleteConfirm.cancel}
        busy={deleteListMutation.isPending}
        intent="danger"
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => deleteListMutation.mutate()}
      />

      {pendingRemovalItemIds.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-4">
          {pendingRemovalItemIds.map((itemId) => (
            <ToastCard
              key={itemId}
              kind="success"
              role="status"
              className="w-full max-w-[340px]"
              message={UI_COPY.saved.detail.removePlaceSuccess}
              action={
                <button
                  type="button"
                  onClick={() => undoQueuedRemoval(itemId)}
                  className="inline-flex h-7 shrink-0 items-center justify-center rounded-full border border-primary-light/34 bg-white/78 px-3 text-xs font-semibold text-primary-hover transition-colors hover:bg-white hover:text-primary md:h-8 md:px-3.5"
                >
                  {UI_COPY.common.action.restore}
                </button>
              }
            />
          ))}
        </div>
      ) : null}
    </PageContainer>
  );
}
