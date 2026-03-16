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
          className={buttonStyles({ shape: "pill", className: "h-12 min-w-56 px-6 font-semibold" })}
        >
          {UI_COPY.home.empty.action}
        </Link>
      }
    />
  );
}
