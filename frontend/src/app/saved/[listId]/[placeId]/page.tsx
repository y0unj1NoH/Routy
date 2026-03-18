"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading-panel";
import { UI_COPY } from "@/constants/ui-copy";
import { PageContainer } from "@/components/layout/page-container";
import { PlaceDetailContent } from "@/components/places/place-detail-content";
import { fetchPlaceDetail } from "@/lib/graphql/api";
import { queryKeys } from "@/lib/query-keys";
import { useRequireAuth } from "@/hooks/use-require-auth";

export default function SavedPlaceDetailPage() {
  const params = useParams<{ listId: string; placeId: string }>();
  const { placeId, listId } = params;
  const { session, isLoading: isAuthLoading, isAuthed } = useRequireAuth();
  const accessToken = session?.access_token;

  const placeQuery = useQuery({
    queryKey: queryKeys.placeDetail(placeId),
    queryFn: () => fetchPlaceDetail(placeId, accessToken ?? ""),
    enabled: Boolean(accessToken && placeId)
  });

  const place = placeQuery.data;

  if (isAuthLoading || !isAuthed) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.common.loading.authCheck} />
      </PageContainer>
    );
  }

  if (placeQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.saved.placeDetail.loading} />
      </PageContainer>
    );
  }

  if (placeQuery.isError || !place) {
    return (
      <PageContainer>
        <EmptyState
          title={UI_COPY.saved.placeDetail.notFoundTitle}
          description={UI_COPY.saved.placeDetail.savedDescription}
          mascotVariant="surprise"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-5 pt-5">
      <PlaceDetailContent place={place} />
    </PageContainer>
  );
}
