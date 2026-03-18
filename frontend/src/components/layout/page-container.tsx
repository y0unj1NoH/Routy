import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export const PAGE_CONTENT_X_PADDING_CLASS = "px-[var(--page-x-padding)]";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-[var(--page-content-max-width)] pb-[var(--page-bottom-padding)] pt-[var(--page-top-padding)]",
        PAGE_CONTENT_X_PADDING_CLASS,
        className
      )}
    >
      {children}
    </main>
  );
}
