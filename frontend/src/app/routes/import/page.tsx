"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Star } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { CategoryBadge } from "@/components/common/category-badge";
import { DialogFieldHint, DialogFieldLabel } from "@/components/common/dialog-field";
import { LinkInput } from "@/components/common/link-input";
import { LoadingPanel } from "@/components/common/loading-panel";
import { PageTitle } from "@/components/common/page-title";
import { PlacePhoto } from "@/components/common/place-photo";
import { SectionHeader } from "@/components/common/section-header";
import { UI_COPY } from "@/constants/ui-copy";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { safeZodResolver } from "@/lib/forms/safe-zod-resolver";
import {
  crawlerImportFormSchema,
  googleMapsImportFormSchema,
  PLACE_LIST_CITY_MAX_LENGTH,
  PLACE_LIST_NAME_MAX_LENGTH
} from "@/lib/forms/input-schemas";
import { importPlaceFromGoogleLink, importPlaceListFromCrawler } from "@/lib/graphql/api";
import { resolveImportErrorMessage } from "@/lib/graphql/import-errors";
import { queryKeys } from "@/lib/query-keys";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useUiStore } from "@/stores/ui-store";
import type { Place } from "@/types/domain";

type CrawlerImportValues = z.infer<typeof crawlerImportFormSchema>;
type GoogleImportValues = z.infer<typeof googleMapsImportFormSchema>;

export default function ImportRoutePage() {
  const crawlerFormId = useId();
  const crawlerUrlFieldId = `${crawlerFormId}-crawler-url`;
  const crawlerListNameFieldId = `${crawlerFormId}-list-name`;
  const crawlerCityFieldId = `${crawlerFormId}-city`;
  const googleFormId = useId();
  const queryClient = useQueryClient();
  const pushToast = useUiStore((state) => state.pushToast);
  const { session, isLoading: isAuthLoading, isAuthed } = useRequireAuth();
  const accessToken = session?.access_token;

  const [importedCount, setImportedCount] = useState(0);
  const [importedListId, setImportedListId] = useState<string | null>(null);
  const [importedPlaces, setImportedPlaces] = useState<Place[]>([]);
  const crawlerForm = useForm<CrawlerImportValues>({
    resolver: safeZodResolver(crawlerImportFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      crawlerUrl: "",
      listName: "",
      city: ""
    }
  });
  const googleForm = useForm<GoogleImportValues>({
    resolver: safeZodResolver(googleMapsImportFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      googleUrl: ""
    }
  });

  const crawlerUrl = crawlerForm.watch("crawlerUrl");
  const city = crawlerForm.watch("city");
  const googleUrl = googleForm.watch("googleUrl");

  const crawlerMutation = useMutation({
    mutationFn: (values: { url: string; listName: string; city: string }) => importPlaceListFromCrawler(accessToken ?? "", values),
    onSuccess: (data) => {
      setImportedListId(data.id);
      pushToast({ kind: "success", message: UI_COPY.routes.import.toast.importListSuccess });
      queryClient.invalidateQueries({ queryKey: queryKeys.myPlaceLists });
      crawlerForm.reset();
    },
    onError: (error: Error) => {
      console.error(error);
      const message = resolveImportErrorMessage(error, UI_COPY.routes.import.toast.importListError);
      crawlerForm.setError("root", { type: "server", message });
      pushToast({ kind: "error", message });
    }
  });

  const googleMutation = useMutation({
    mutationFn: (url: string) => importPlaceFromGoogleLink(accessToken ?? "", url),
    onSuccess: (places) => {
      setImportedCount(places.length);
      setImportedPlaces(places);
      pushToast({ kind: "success", message: UI_COPY.routes.import.toast.importPlacesSuccess(places.length) });
      googleForm.reset();
    },
    onError: (error: Error) => {
      console.error(error);
      const message = resolveImportErrorMessage(error, UI_COPY.routes.import.toast.importPlacesError);
      googleForm.setError("root", { type: "server", message });
      pushToast({ kind: "error", message });
    }
  });

  const onSubmitCrawlerImport = crawlerForm.handleSubmit((values) => {
    crawlerForm.clearErrors("root");
    const resolvedCity = values.city.trim();

    crawlerMutation.mutate({
      url: values.crawlerUrl.trim(),
      listName: values.listName.trim() || resolvedCity,
      city: resolvedCity
    });
  });

  const onSubmitGoogleImport = googleForm.handleSubmit((values) => {
    googleForm.clearErrors("root");
    googleMutation.mutate(values.googleUrl.trim());
  });

  const isImporting = crawlerMutation.isPending || googleMutation.isPending;
  const importingMessage = crawlerMutation.isPending ? UI_COPY.routes.import.loading.lists : UI_COPY.routes.import.loading.places;
  const importingDetail = crawlerMutation.isPending ? UI_COPY.routes.import.loading.listHint : undefined;

  if (isAuthLoading) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.common.loading.authCheck} />
      </PageContainer>
    );
  }

  if (!isAuthed) {
    return null;
  }

  return (
    <PageContainer className="space-y-6">
      <PageTitle title={UI_COPY.routes.import.title} subtitle={UI_COPY.routes.import.subtitle} />

      {isImporting ? <LoadingPanel message={importingMessage} detail={importingDetail} mascotVariant="detective" /> : null}

      <Card className="space-y-5 p-5">
        <SectionHeader
          title={UI_COPY.routes.import.crawlerSection.title}
          description={UI_COPY.routes.import.crawlerSection.description}
        />
        <form id={crawlerFormId} noValidate onSubmit={onSubmitCrawlerImport} className="space-y-4">
          {crawlerForm.formState.errors.root?.message ? (
            <p className="whitespace-pre-line rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {crawlerForm.formState.errors.root.message}
            </p>
          ) : null}

          <div className="space-y-1">
            <DialogFieldLabel htmlFor={crawlerUrlFieldId} required>
              {UI_COPY.importListModal.labels.url}
            </DialogFieldLabel>
            <LinkInput
              id={crawlerUrlFieldId}
              type="url"
              inputMode="url"
              placeholder={UI_COPY.importListModal.placeholders.url}
              aria-invalid={Boolean(crawlerForm.formState.errors.crawlerUrl)}
              {...crawlerForm.register("crawlerUrl")}
            />
            <DialogFieldHint error>{crawlerForm.formState.errors.crawlerUrl?.message}</DialogFieldHint>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <DialogFieldLabel htmlFor={crawlerListNameFieldId} optional>
                {UI_COPY.importListModal.labels.listName}
              </DialogFieldLabel>
              <Input
                id={crawlerListNameFieldId}
                placeholder={UI_COPY.importListModal.placeholders.listName}
                maxLength={PLACE_LIST_NAME_MAX_LENGTH}
                aria-invalid={Boolean(crawlerForm.formState.errors.listName)}
                {...crawlerForm.register("listName")}
              />
              <DialogFieldHint error={Boolean(crawlerForm.formState.errors.listName)}>
                {crawlerForm.formState.errors.listName?.message || UI_COPY.importListModal.hints.listName}
              </DialogFieldHint>
            </div>
            <div className="space-y-1">
              <DialogFieldLabel htmlFor={crawlerCityFieldId} required>
                {UI_COPY.importListModal.labels.city}
              </DialogFieldLabel>
              <Input
                id={crawlerCityFieldId}
                placeholder={UI_COPY.importListModal.placeholders.city}
                maxLength={PLACE_LIST_CITY_MAX_LENGTH}
                aria-invalid={Boolean(crawlerForm.formState.errors.city)}
                {...crawlerForm.register("city")}
              />
              <DialogFieldHint error>{crawlerForm.formState.errors.city?.message}</DialogFieldHint>
            </div>
          </div>
          <Button
            type="submit"
            size="large"
            disabled={isImporting || !crawlerUrl.trim() || !city.trim()}
          >
            {crawlerMutation.isPending ? UI_COPY.routes.import.crawlerSection.submitting : UI_COPY.routes.import.crawlerSection.submit}
          </Button>
        </form>
        {importedListId ? (
          <Link
            href={`/saved/${importedListId}`}
            className={buttonStyles({ variant: "secondary", size: "small", className: "font-semibold" })}
          >
            {UI_COPY.routes.import.crawlerSection.openDetail}
          </Link>
        ) : null}
      </Card>

      <Card className="space-y-5 p-5">
        <SectionHeader
          title={UI_COPY.routes.import.googleSection.title}
          description={UI_COPY.routes.import.googleSection.description}
        />
        <form id={googleFormId} noValidate onSubmit={onSubmitGoogleImport} className="space-y-4">
          {googleForm.formState.errors.root?.message ? (
            <p className="whitespace-pre-line rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {googleForm.formState.errors.root.message}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <LinkInput
              type="url"
              inputMode="url"
              placeholder={UI_COPY.routes.import.googleSection.placeholder}
              aria-invalid={Boolean(googleForm.formState.errors.googleUrl)}
              {...googleForm.register("googleUrl")}
            />
            <p className="text-xs text-danger">{googleForm.formState.errors.googleUrl?.message}</p>
          </div>

          <Button type="submit" size="large" disabled={isImporting || !googleUrl.trim()}>
            {googleMutation.isPending ? UI_COPY.routes.import.googleSection.submitting : UI_COPY.routes.import.googleSection.submit}
          </Button>
        </form>
        <p className="text-sm text-foreground/70">{UI_COPY.routes.import.googleSection.importedCount(importedCount)}</p>
      </Card>

      {importedPlaces.length > 0 ? (
        <Card className="space-y-5 p-5">
          <SectionHeader
            title={UI_COPY.routes.import.recentPlaces.title}
            description={UI_COPY.routes.import.recentPlaces.description}
          />
          <div className="grid gap-3">
            {importedPlaces.map((place) => (
              <div
                key={place.id}
                className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/92 p-4 transition-colors hover:bg-muted/35 md:flex-row md:rounded-2xl"
              >
                <PlacePhoto
                  name={place.name}
                  coverPhoto={place.coverPhoto}
                  className="h-28 w-full shrink-0 rounded-xl md:h-24 md:w-28 md:rounded-2xl"
                  sizes="(max-width: 767px) 100vw, 112px"
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge value={place.categories[0] ?? null} fallbackTone="primary" />
                      {typeof place.rating === "number" ? (
                        <Badge className="gap-1">
                          <Star fill="currentColor" className="h-3.5 w-3.5 text-star" />
                          {place.rating.toFixed(1)}
                        </Badge>
                      ) : null}
                    </div>
                    <h3 className="text-lg font-black">{place.name || UI_COPY.routes.import.recentPlaces.placeFallback}</h3>
                    <p className="text-sm text-foreground/64">{place.formattedAddress || UI_COPY.routes.import.recentPlaces.addressFallback}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/places/${place.id}`}>
                      <Button variant="secondary" size="small">
                        {UI_COPY.routes.import.recentPlaces.detailAction}
                      </Button>
                    </Link>
                    {place.googleMapsUrl ? (
                      <a href={place.googleMapsUrl} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="small">
                          Google Maps
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </PageContainer>
  );
}
