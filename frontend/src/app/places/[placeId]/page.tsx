"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading-panel";
import { PageBackButton } from "@/components/common/page-back-button";
import { UI_COPY } from "@/constants/ui-copy";
import { PageContainer } from "@/components/layout/page-container";
import { PlaceDetailContent } from "@/components/places/place-detail-content";
import { fetchPlaceDetail } from "@/lib/graphql/api";
import { queryKeys } from "@/lib/query-keys";
import { useRequireAuth } from "@/hooks/use-require-auth";

export default function PlaceDetailPage() {
  const params = useParams<{ placeId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeId = params.placeId;
  const visitDate = searchParams.get("visitDate");

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
          description={UI_COPY.saved.placeDetail.directDescription}
          mascotVariant="surprise"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-5 pt-5">
      <PlaceDetailContent
        place={place}
        visitDate={visitDate}
        backAction={
          <PageBackButton
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back();
                return;
              }
              router.replace("/");
            }}
          />
        }
      />
    </PageContainer>
  );
}
