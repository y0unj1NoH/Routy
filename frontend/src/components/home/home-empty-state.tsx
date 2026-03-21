import Link from "next/link";

import { PageEmptyState } from "@/components/common/page-empty-state";
import { UI_COPY } from "@/constants/ui-copy";
import { buttonStyles } from "@/components/ui/button-styles";

type HomeEmptyStateProps = {
  previewLabel?: string;
};

export function HomeEmptyState({ previewLabel }: HomeEmptyStateProps) {
  return (
    <PageEmptyState
      mascotVariant="airplane"
      mascotSize="featured"
      mascotMotion="floating"
      title={UI_COPY.home.empty.title}
      description={UI_COPY.home.empty.description}
      previewLabel={previewLabel}
      action={
        <Link
          href="/routes/new"
          className={buttonStyles({ size: "large", shape: "pill", fullWidth: true, className: "md:w-auto md:min-w-48" })}
        >
          {UI_COPY.home.empty.action}
        </Link>
      }
    />
  );
}

