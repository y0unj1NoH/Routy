import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export const PAGE_CONTENT_X_PADDING_CLASS = "px-5 md:px-9";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className }: PageContainerProps) {
  return <main className={cn("mx-auto w-full max-w-[1280px] pb-10 pt-10 md:pb-12", PAGE_CONTENT_X_PADDING_CLASS, className)}>{children}</main>;
}
