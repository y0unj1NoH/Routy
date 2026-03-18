import { PageEmptyState } from "@/components/common/page-empty-state";
import { UI_COPY } from "@/constants/ui-copy";
import { Button } from "@/components/ui/button";

type SavedEmptyStateProps = {
  onImport: () => void;
};

export function SavedEmptyState({ onImport }: SavedEmptyStateProps) {
  return (
    <PageEmptyState
      mascotVariant="detective"
      mascotSize="featured"
      title={UI_COPY.saved.index.emptyTitle}
      description={UI_COPY.saved.index.emptyDescription}
      action={
        <Button onClick={onImport} size="large" shape="pill" fullWidth className="font-semibold md:w-auto md:min-w-48">
          {UI_COPY.saved.index.emptyAction}
        </Button>
      }
    />
  );
}
