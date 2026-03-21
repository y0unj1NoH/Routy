"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  captureAnalyticsEvent,
  getAppPageViewProperties,
  posthogEnabled,
  syncReplayForPath
} from "@/lib/analytics";

export function AppAnalyticsRuntime() {
  const pathname = usePathname();
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!posthogEnabled) {
      return;
    }

    if (lastTrackedPathRef.current === pathname) {
      return;
    }

    lastTrackedPathRef.current = pathname;
    captureAnalyticsEvent(
      "app_page_viewed",
      getAppPageViewProperties(pathname, new URLSearchParams(window.location.search))
    );
  }, [pathname]);

  useEffect(() => {
    if (!posthogEnabled) {
      return;
    }

    syncReplayForPath(pathname);
  }, [pathname]);

  return null;
}
