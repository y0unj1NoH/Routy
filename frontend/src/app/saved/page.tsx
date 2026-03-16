"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/common/empty-state";
import { ListItemCard } from "@/components/common/list-item-card";
import { LoadingPanel } from "@/components/common/loading-panel";
import { ImportListModal } from "@/components/import/import-list-modal";
import { PageTitle } from "@/components/common/page-title";
import { SavedEmptyState } from "@/components/saved/saved-empty-state";
import { UI_COPY } from "@/constants/ui-copy";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { fetchMyPlaceLists } from "@/lib/graphql/api";
import { queryKeys } from "@/lib/query-keys";
import { useRequireAuth } from "@/hooks/use-require-auth";

export default function SavedPage() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const { session, isLoading: isAuthLoading, isAuthed } = useRequireAuth();
  const accessToken = session?.access_token;

  const placeListsQuery = useQuery({
    queryKey: queryKeys.myPlaceLists,
    queryFn: () => fetchMyPlaceLists(accessToken ?? ""),
    enabled: Boolean(accessToken)
  });

  if (isAuthLoading || !isAuthed) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.common.loading.authCheck} />
      </PageContainer>
    );
  }

  if (placeListsQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.saved.index.loading} />
      </PageContainer>
    );
  }

  if (placeListsQuery.isError) {
    return (
      <PageContainer>
        <EmptyState
          title={UI_COPY.saved.index.errorTitle}
          description={UI_COPY.saved.index.errorDescription}
          mascotVariant="surprise"
        />
      </PageContainer>
    );
  }

  const lists = placeListsQuery.data || [];

  if (lists.length === 0) {
    return (
      <PageContainer className="flex min-h-full flex-1 flex-col gap-10">
        <PageTitle title={UI_COPY.saved.index.title} subtitle={UI_COPY.saved.index.subtitle} />
        <div className="flex flex-1 items-center justify-center">
          <div className="-translate-y-[calc(var(--bottom-nav-offset)/2)]">
            <SavedEmptyState onImport={() => setIsImportModalOpen(true)} />
          </div>
        </div>
        <ImportListModal
          isOpen={isImportModalOpen}
          accessToken={accessToken ?? ""}
          onClose={() => setIsImportModalOpen(false)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-8 pb-[calc(11rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title={UI_COPY.saved.index.title} subtitle={UI_COPY.saved.index.subtitle} />
        <Button size="sm" onClick={() => setIsImportModalOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> {UI_COPY.saved.index.addAction}
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
        {lists.map((list) => (
          <ListItemCard
            key={list.id}
            href={`/saved/${list.id}`}
            title={`${list.name} | ${list.city}`}
            description={UI_COPY.saved.index.listCount(list.itemCount)}
            previewPlaces={list.previewPlaces}
          />
        ))}
      </section>

      <ImportListModal
        isOpen={isImportModalOpen}
        accessToken={accessToken ?? ""}
        onClose={() => setIsImportModalOpen(false)}
      />
    </PageContainer>
  );
}
