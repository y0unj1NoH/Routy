import posthog from "posthog-js";

import { publicEnv } from "@/lib/env";
import { AppGraphQLError } from "@/lib/graphql/client";

export type AppPageKey =
  | "home"
  | "login"
  | "signup"
  | "auth_callback"
  | "saved"
  | "saved_list"
  | "saved_place_detail"
  | "place_detail"
  | "route_import"
  | "route_new"
  | "route_recommendation"
  | "route_detail"
  | "mypage"
  | "unknown";

export type RouteCreateStep = "list" | "date" | "stay" | "companions" | "style";

type SearchParamsLike = {
  get(name: string): string | null;
};

type RouteCreateAnalyticsPayload = {
  day_count?: number;
  stay_mode?: "booked" | "unbooked" | null;
  companions?: string | null;
  pace?: string | null;
  theme_count?: number;
  must_visit_count?: number;
};

type RouteEditAnalyticsPayload = {
  schedule_id: string;
  changed_day_count: number;
  added_existing_place_count: number;
  added_google_place_count: number;
  reordered_stop_count: number;
  moved_day_count: number;
  deleted_stop_count: number;
  restored_stop_count: number;
};

type AnalyticsEventMap = {
  graphql_error_presented: {
    source: string;
    error_code: string;
    support_code?: string;
    error_kind?: string;
    expected: boolean;
  };
  app_page_viewed: {
    page_key: AppPageKey;
    source?: string;
  };
  auth_login_submitted: {
    method: "password" | "google";
    destination_path?: string;
  };
  auth_login_succeeded: {
    method: "password" | "google";
    destination_path?: string;
  };
  auth_signup_submitted: {
    method: "password";
  };
  auth_signup_succeeded: {
    method: "password";
  };
  auth_logout_clicked: {
    source: "mypage";
  };
  auth_logout_succeeded: {
    source: "mypage";
  };
  list_import_modal_opened: {
    source: string;
  };
  list_import_started: {
    source: string;
  };
  list_import_succeeded: {
    source: string;
    imported_count?: number;
  };
  list_import_failed: {
    source: string;
    error_code?: string;
  };
  google_place_import_started: {
    source: string;
  };
  google_place_import_succeeded: {
    source: string;
    imported_count: number;
  };
  google_place_import_failed: {
    source: string;
    error_code?: string;
  };
  route_create_step_viewed: RouteCreateAnalyticsPayload & {
    step: RouteCreateStep;
  };
  route_create_step_completed: RouteCreateAnalyticsPayload & {
    step: RouteCreateStep;
    next_step: RouteCreateStep;
  };
  route_create_blocked: RouteCreateAnalyticsPayload & {
    step: RouteCreateStep;
    reason: string;
  };
  route_create_started: RouteCreateAnalyticsPayload;
  route_create_succeeded: RouteCreateAnalyticsPayload;
  route_create_failed: RouteCreateAnalyticsPayload & {
    error_code?: string;
  };
  route_recommendation_viewed: {
    schedule_id: string;
    day_count: number;
    stay_mode: "booked" | "recommended" | "none";
  };
  route_recommendation_confirmed: {
    schedule_id: string;
    day_count: number;
    stay_mode: "booked" | "recommended" | "none";
  };
  route_recommendation_regenerated: {
    schedule_id: string;
  };
  route_edit_started: {
    schedule_id: string;
    day_count: number;
  };
  route_edit_saved: RouteEditAnalyticsPayload;
  route_edit_cancelled: RouteEditAnalyticsPayload & {
    had_changes: boolean;
  };
  place_detail_opened: {
    source: string;
  };
};

export const posthogEnabled = publicEnv.posthogEnabled;

function canUseAnalytics() {
  return posthogEnabled && typeof window !== "undefined";
}

function isLocalAnalyticsRuntime() {
  return publicEnv.appEnvironment === "local" && !publicEnv.localObservabilityEnabled;
}

export function captureAnalyticsEvent<EventName extends keyof AnalyticsEventMap>(
  event: EventName,
  properties: AnalyticsEventMap[EventName]
) {
  if (!canUseAnalytics()) {
    return;
  }

  posthog.capture(event, properties);
}

export function identifyAnalyticsUser(userId: string) {
  if (!canUseAnalytics()) {
    return;
  }

  posthog.identify(userId);
}

export function resetAnalyticsUser() {
  if (!canUseAnalytics()) {
    return;
  }

  posthog.reset();
}

export function startAnalyticsReplay() {
  if (!canUseAnalytics() || isLocalAnalyticsRuntime()) {
    return;
  }

  if (posthog.sessionRecordingStarted()) {
    return;
  }

  posthog.startSessionRecording();
}

export function stopAnalyticsReplay() {
  if (!canUseAnalytics()) {
    return;
  }

  if (!posthog.sessionRecordingStarted()) {
    return;
  }

  posthog.stopSessionRecording();
}

export function syncReplayForPath(pathname: string) {
  if (shouldReplayPath(pathname)) {
    startAnalyticsReplay();
    return;
  }

  stopAnalyticsReplay();
}

export function shouldReplayPath(pathname: string) {
  return pathname === "/routes/new" || pathname === "/routes/recommendation" || /^\/routes\/[^/]+$/.test(pathname);
}

function getInternalReferrerPageKey() {
  if (typeof window === "undefined" || !document.referrer) {
    return null;
  }

  try {
    const referrer = new URL(document.referrer);
    if (referrer.origin !== window.location.origin) {
      return null;
    }

    return resolveAppPageKey(referrer.pathname);
  } catch {
    return null;
  }
}

export function resolveAppPageKey(pathname: string): AppPageKey {
  if (pathname === "/") return "home";
  if (pathname === "/login") return "login";
  if (pathname === "/signup") return "signup";
  if (pathname === "/auth/callback") return "auth_callback";
  if (pathname === "/saved") return "saved";
  if (/^\/saved\/[^/]+\/[^/]+$/.test(pathname)) return "saved_place_detail";
  if (/^\/saved\/[^/]+$/.test(pathname)) return "saved_list";
  if (/^\/places\/[^/]+$/.test(pathname)) return "place_detail";
  if (pathname === "/routes/import") return "route_import";
  if (pathname === "/routes/new") return "route_new";
  if (pathname === "/routes/recommendation") return "route_recommendation";
  if (/^\/routes\/[^/]+$/.test(pathname)) return "route_detail";
  if (pathname === "/mypage") return "mypage";
  return "unknown";
}

export function getAppPageViewProperties(pathname: string, searchParams: SearchParamsLike): AnalyticsEventMap["app_page_viewed"] {
  const pageKey = resolveAppPageKey(pathname);
  const referrerPageKey = getInternalReferrerPageKey();

  if (pathname === "/login") {
    return {
      page_key: pageKey,
      source: searchParams.get("next") ? "auth_redirect" : referrerPageKey ?? undefined
    };
  }

  if (pathname === "/auth/callback") {
    return {
      page_key: pageKey,
      source: "google_oauth"
    };
  }

  if (pathname === "/routes/recommendation") {
    return {
      page_key: pageKey,
      source: searchParams.get("status") || referrerPageKey || undefined
    };
  }

  if (/^\/places\/[^/]+$/.test(pathname)) {
    return {
      page_key: pageKey,
      source: searchParams.get("visitDate") ? "schedule" : referrerPageKey ?? undefined
    };
  }

  if (/^\/saved\/[^/]+\/[^/]+$/.test(pathname)) {
    return {
      page_key: pageKey,
      source: "saved_list"
    };
  }

  return {
    page_key: pageKey,
    source: referrerPageKey ?? undefined
  };
}

export function getAnalyticsErrorCode(error: unknown) {
  if (error instanceof AppGraphQLError) {
    return error.code;
  }

  if (error instanceof Error) {
    return error.name || "ERROR";
  }

  return "UNKNOWN";
}
