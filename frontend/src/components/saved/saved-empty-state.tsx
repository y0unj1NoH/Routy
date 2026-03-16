import { PageEmptyState } from "@/components/common/page-empty-state";
import { MASCOT_SIZE_CLASS } from "@/components/layout/mascot";
import { UI_COPY } from "@/constants/ui-copy";
import { Button } from "@/components/ui/button";

type SavedEmptyStateProps = {
  onImport: () => void;
};

export function SavedEmptyState({ onImport }: SavedEmptyStateProps) {
  return (
    <PageEmptyState
      mascotVariant="detective"
      mascotClassName={MASCOT_SIZE_CLASS.compact}
      title={UI_COPY.saved.index.emptyTitle}
      description={UI_COPY.saved.index.emptyDescription}
      action={
        <Button onClick={onImport} shape="pill" className="h-12 min-w-56 px-6 font-semibold">
          {UI_COPY.saved.index.emptyAction}
        </Button>
      }
    />
  );
}
