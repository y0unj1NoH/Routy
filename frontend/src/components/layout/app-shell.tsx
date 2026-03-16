"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { ToastViewport } from "@/components/layout/toast-viewport";
import { cn } from "@/lib/cn";

type AppShellProps = {
  children: ReactNode;
};

const HIDE_NAV_ROUTES = ["/login", "/signup", "/auth/callback"];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const hideNav = HIDE_NAV_ROUTES.some((route) => pathname.startsWith(route));

  return (
    <div className={cn("flex min-h-dvh flex-col bg-background text-foreground")}>
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col",
          !hideNav && "pb-(--bottom-nav-offset)"
        )}
      >
        {children}
      </div>
      {!hideNav ? <BottomNav /> : null}
      <ToastViewport />
    </div>
  );
}
