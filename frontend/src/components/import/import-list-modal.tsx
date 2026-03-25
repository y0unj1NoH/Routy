"use client";

import { useEffect, useId } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DialogFieldHint, DialogFieldLabel } from "@/components/common/dialog-field";
import { DialogShell } from "@/components/common/dialog-shell";
import { ImportListWarningNotice } from "@/components/import/import-list-warning-notice";
import { LinkInput } from "@/components/common/link-input";
import { LoadingPanel } from "@/components/common/loading-panel";
import { UI_COPY } from "@/constants/ui-copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { captureAnalyticsEvent, getAnalyticsErrorCode } from "@/lib/analytics";
import { safeZodResolver } from "@/lib/forms/safe-zod-resolver";
import {
  crawlerImportFormSchema,
  PLACE_LIST_CITY_MAX_LENGTH,
  PLACE_LIST_NAME_MAX_LENGTH
} from "@/lib/forms/input-schemas";
import { importPlaceListFromCrawler } from "@/lib/graphql/api";
import { resolveImportErrorMessage } from "@/lib/graphql/import-errors";
import { queryKeys } from "@/lib/query-keys";
import { useUiStore } from "@/stores/ui-store";

type ImportedList = {
  id: string;
  name: string;
  city: string;
};

type ImportListModalProps = {
  isOpen: boolean;
  accessToken: string;
  source: string;
  onClose: () => void;
  onImported?: (list: ImportedList) => void;
};

type ImportListModalValues = z.infer<typeof crawlerImportFormSchema>;

export function ImportListModal({ isOpen, accessToken, source, onClose, onImported }: ImportListModalProps) {
  const formId = useId();
  const crawlerUrlFieldId = `${formId}-crawler-url`;
  const listNameFieldId = `${formId}-list-name`;
  const cityFieldId = `${formId}-city`;
  const queryClient = useQueryClient();
  const pushToast = useUiStore((state) => state.pushToast);
  const form = useForm<ImportListModalValues>({
    resolver: safeZodResolver(crawlerImportFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      crawlerUrl: "",
      listName: "",
      city: ""
    }
  });

  const crawlerUrl = form.watch("crawlerUrl");
  const city = form.watch("city");

  useEffect(() => {
    if (!isOpen) return;
    captureAnalyticsEvent("list_import_modal_opened", { source });
  }, [isOpen, source]);

  const handleClose = () => {
    form.clearErrors();
    onClose();
  };

  const crawlerMutation = useMutation({
    mutationFn: (values: { url: string; listName: string; city: string }) => importPlaceListFromCrawler(accessToken, values),
    onSuccess: (data) => {
      captureAnalyticsEvent("list_import_succeeded", {
        source,
        imported_count: data.itemCount
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.myPlaceLists });
      pushToast({ kind: "success", message: UI_COPY.importListModal.success });
      form.reset();
      onImported?.({ id: data.id, name: data.name, city: data.city });
      handleClose();
    },
    onError: (error: Error) => {
      console.error(error);
      captureAnalyticsEvent("list_import_failed", {
        source,
        error_code: getAnalyticsErrorCode(error)
      });
      const message = resolveImportErrorMessage(error, UI_COPY.importListModal.error);
      form.setError("root", { type: "server", message });
      pushToast({ kind: "error", message });
    }
  });

  const onSubmit = form.handleSubmit((values) => {
    form.clearErrors("root");
    captureAnalyticsEvent("list_import_started", { source });
    const resolvedCity = values.city.trim();

    crawlerMutation.mutate({
      url: values.crawlerUrl.trim(),
      listName: values.listName.trim() || resolvedCity,
      city: resolvedCity
    });
  });

  if (!isOpen) return null;

  if (crawlerMutation.isPending) {
    return (
      <LoadingPanel
        mascotVariant="detective"
        message={UI_COPY.importListModal.loading}
        detail={UI_COPY.importListModal.loadingHint}
      />
    );
  }

  return (
    <DialogShell
      open={isOpen}
      eyebrow="Import List"
      title={UI_COPY.importListModal.title}
      busy={crawlerMutation.isPending}
      mascotVariant={null}
      showCloseButton={false}
      headerClassName="bg-[linear-gradient(135deg,rgba(232,244,255,0.94),rgba(255,255,255,1)_72%)]"
      size="lg"
      onClose={handleClose}
      footer={
        <>
          <Button
            variant="secondary"
            size="medium"
            onClick={() => {
              if (crawlerMutation.isPending) return;
              handleClose();
            }}
          >
            {UI_COPY.importListModal.close}
          </Button>
          <Button
            type="submit"
            form={formId}
            size="medium"
            disabled={crawlerMutation.isPending || !crawlerUrl.trim() || !city.trim()}
          >
            {crawlerMutation.isPending ? UI_COPY.importListModal.submitting : UI_COPY.importListModal.submit}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={onSubmit} className="space-y-4">
        {form.formState.errors.root?.message ? (
          <p className="whitespace-pre-line rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <ImportListWarningNotice />

        <div className="grid gap-3">
          <div className="space-y-1">
            <DialogFieldLabel htmlFor={crawlerUrlFieldId} required>
              {UI_COPY.importListModal.labels.url}
            </DialogFieldLabel>
            <LinkInput
              id={crawlerUrlFieldId}
              type="url"
              inputMode="url"
              placeholder={UI_COPY.importListModal.placeholders.url}
              aria-invalid={Boolean(form.formState.errors.crawlerUrl)}
              {...form.register("crawlerUrl")}
            />
            <DialogFieldHint error>{form.formState.errors.crawlerUrl?.message}</DialogFieldHint>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <DialogFieldLabel htmlFor={listNameFieldId} optional>
                {UI_COPY.importListModal.labels.listName}
              </DialogFieldLabel>
              <Input
                id={listNameFieldId}
                placeholder={UI_COPY.importListModal.placeholders.listName}
                maxLength={PLACE_LIST_NAME_MAX_LENGTH}
                aria-invalid={Boolean(form.formState.errors.listName)}
                {...form.register("listName")}
              />
              <DialogFieldHint error={Boolean(form.formState.errors.listName)}>
                {form.formState.errors.listName?.message || UI_COPY.importListModal.hints.listName}
              </DialogFieldHint>
            </div>
            <div className="space-y-1">
              <DialogFieldLabel htmlFor={cityFieldId} required>
                {UI_COPY.importListModal.labels.city}
              </DialogFieldLabel>
              <Input
                id={cityFieldId}
                placeholder={UI_COPY.importListModal.placeholders.city}
                maxLength={PLACE_LIST_CITY_MAX_LENGTH}
                aria-invalid={Boolean(form.formState.errors.city)}
                {...form.register("city")}
              />
              <DialogFieldHint error>{form.formState.errors.city?.message}</DialogFieldHint>
            </div>
          </div>
        </div>
      </form>
    </DialogShell>
  );
}
