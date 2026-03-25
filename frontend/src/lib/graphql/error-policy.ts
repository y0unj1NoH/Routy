"use client";

import type { ReactNode } from "react";

import { UI_COPY } from "@/constants/ui-copy";
import { captureAnalyticsEvent } from "@/lib/analytics";
import { AppGraphQLError, type AppGraphQLErrorCode } from "@/lib/graphql/client";

type GraphQLErrorPolicy = {
  sentry: "ignore" | "capture";
  supportCode: string;
  message?: string | ((error: AppGraphQLError) => string | null);
};

type UserFacingGraphQLErrorPresentation = {
  message: string;
  supportCode: string | null;
};

function resolveNumericDetail(error: AppGraphQLError, key: string, fallback: number) {
  const rawValue = (error.details as Record<string, unknown> | null | undefined)?.[key];
  return typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : fallback;
}

function resolveDetailKind(error: AppGraphQLError) {
  const kind = (error.details as Record<string, unknown> | null | undefined)?.kind;
  return typeof kind === "string" && kind.trim() ? kind : null;
}

const GRAPHQL_ERROR_POLICY: Partial<Record<AppGraphQLErrorCode, GraphQLErrorPolicy>> = {
  UNAUTHENTICATED: {
    sentry: "ignore",
    supportCode: "AUTH-401"
  },
  BAD_USER_INPUT: {
    sentry: "ignore",
    supportCode: "GQL-400"
  },
  DATE_INPUT_INVALID: {
    sentry: "ignore",
    supportCode: "DATE-001",
    message: (error) => {
      const kind = resolveDetailKind(error);
      if (kind === "DAY_COUNT_INVALID") {
        return UI_COPY.common.error.invalidTripDuration(resolveNumericDetail(error, "max", 7));
      }
      return UI_COPY.common.error.invalidTripDate;
    }
  },
  PLACE_LIST_SELECTION_INVALID: {
    sentry: "ignore",
    supportCode: "ROUTE-008",
    message: UI_COPY.common.error.invalidPlaceListSelection
  },
  REGENERATION_INPUT_INVALID: {
    sentry: "ignore",
    supportCode: "ROUTE-009",
    message: (error) => {
      const kind = resolveDetailKind(error);
      if (kind === "DATE_RANGE_REQUIRED") {
        return UI_COPY.common.error.regenerateDateRangeRequired;
      }
      return UI_COPY.common.error.invalidInput;
    }
  },
  SCHEDULE_STOP_MOVE_INVALID: {
    sentry: "ignore",
    supportCode: "ROUTE-010",
    message: UI_COPY.common.error.invalidScheduleStopMove
  },
  SCHEDULE_EDIT_INVALID: {
    sentry: "ignore",
    supportCode: "ROUTE-011",
    message: (error) => {
      const kind = resolveDetailKind(error);
      if (kind === "PLACE_ID_REQUIRED") {
        return UI_COPY.common.error.scheduleEditPlaceRequired;
      }
      if (kind === "PLACE_NOT_IN_LIST") {
        return UI_COPY.common.error.scheduleEditPlaceNotInList;
      }
      if (kind === "DUPLICATE_PLACE") {
        return UI_COPY.common.error.scheduleEditDuplicatePlace;
      }
      return UI_COPY.common.error.invalidScheduleEdit;
    }
  },
  SCHEDULE_CONFIRMATION_REQUIRED: {
    sentry: "ignore",
    supportCode: "ROUTE-012",
    message: UI_COPY.common.error.scheduleConfirmationRequired
  },
  PLACE_LIST_HAS_SCHEDULES: {
    sentry: "ignore",
    supportCode: "LIST-001",
    message: UI_COPY.saved.detail.deleteBlockedBySchedulesError
  },
  GOOGLE_MAPS_LIST_LINK_REQUIRED: {
    sentry: "ignore",
    supportCode: "IMPORT-001",
    message: UI_COPY.common.error.googleMapsListLinkRequired
  },
  GOOGLE_MAPS_PLACE_LINK_REQUIRED: {
    sentry: "ignore",
    supportCode: "IMPORT-002",
    message: UI_COPY.common.error.googleMapsPlaceLinkRequired
  },
  GOOGLE_MAPS_LIST_ITEM_LIMIT_EXCEEDED: {
    sentry: "ignore",
    supportCode: "IMPORT-003",
    message: (error) => UI_COPY.common.error.googleMapsListItemLimitExceeded(resolveNumericDetail(error, "limit", 50))
  },
  PLACE_LIST_ITEM_LIMIT_EXCEEDED: {
    sentry: "ignore",
    supportCode: "LIST-002",
    message: (error) => UI_COPY.common.error.placeListItemLimitExceeded(resolveNumericDetail(error, "limit", 50))
  },
  IMPORT_LIST_QUOTA_EXCEEDED: {
    sentry: "ignore",
    supportCode: "IMPORT-101",
    message: UI_COPY.common.error.importRequestQuotaExceeded
  },
  IMPORT_PLACE_QUOTA_EXCEEDED: {
    sentry: "ignore",
    supportCode: "IMPORT-102",
    message: UI_COPY.common.error.importPlaceQuotaExceeded
  },
  MUST_VISIT_LIMIT_EXCEEDED: {
    sentry: "ignore",
    supportCode: "ROUTE-001",
    message: (error) => {
      const dayCount = resolveNumericDetail(error, "dayCount", 0);
      const limit = resolveNumericDetail(error, "limit", 0);
      const copy = UI_COPY.routes.new.toast.mustVisitLimitExceeded(dayCount, limit);
      return `${copy.title}\n${copy.description}`;
    }
  },
  AI_CANDIDATE_LIMIT_EXCEEDED: {
    sentry: "ignore",
    supportCode: "ROUTE-002",
    message: (error) => UI_COPY.common.error.aiCandidateLimitExceeded(resolveNumericDetail(error, "limit", 70))
  },
  PLACE_LIST_EMPTY_FOR_SCHEDULE: {
    sentry: "ignore",
    supportCode: "ROUTE-003",
    message: UI_COPY.common.error.schedulePlaceListEmpty
  },
  SCHEDULE_NO_SCHEDULABLE_PLACES: {
    sentry: "ignore",
    supportCode: "ROUTE-004",
    message: UI_COPY.common.error.scheduleNoSchedulablePlaces
  },
  SCHEDULE_CANDIDATES_EMPTY_AFTER_PREPROCESS: {
    sentry: "ignore",
    supportCode: "ROUTE-005",
    message: UI_COPY.common.error.scheduleCandidatesEmptyAfterPreprocess
  },
  STAY_PLACE_NOT_IN_LIST: {
    sentry: "ignore",
    supportCode: "ROUTE-006",
    message: UI_COPY.common.error.stayPlaceNotInList
  },
  STAY_PLACE_DATA_MISSING: {
    sentry: "ignore",
    supportCode: "ROUTE-007",
    message: UI_COPY.common.error.stayPlaceDataMissing
  },
  AI_DAILY_QUOTA_EXCEEDED: {
    sentry: "ignore",
    supportCode: "AI-101",
    message: UI_COPY.common.error.aiDailyQuotaExceeded
  },
  AI_SYSTEM_MONTHLY_QUOTA_EXCEEDED: {
    sentry: "ignore",
    supportCode: "AI-102",
    message: UI_COPY.common.error.aiMonthlyQuotaExceeded
  },
  NOT_FOUND: {
    sentry: "ignore",
    supportCode: "GQL-404"
  },
  TOO_MANY_REQUESTS: {
    sentry: "ignore",
    supportCode: "GQL-429",
    message: UI_COPY.common.error.tooManyRequests
  },
  INTERNAL_SERVER_ERROR: {
    sentry: "capture",
    supportCode: "SYS-500"
  },
  NETWORK_ERROR: {
    sentry: "capture",
    supportCode: "SYS-NET"
  },
  UNKNOWN: {
    sentry: "capture",
    supportCode: "SYS-000"
  }
};

export const EXPECTED_GRAPHQL_ERROR_CODES = new Set<AppGraphQLErrorCode>(
  Object.entries(GRAPHQL_ERROR_POLICY)
    .filter(([, policy]) => policy?.sentry === "ignore")
    .map(([code]) => code as AppGraphQLErrorCode)
);

export function isExpectedGraphQLError(error: Error) {
  return error instanceof AppGraphQLError && EXPECTED_GRAPHQL_ERROR_CODES.has(error.code);
}

export function resolveKnownGraphQLErrorMessage(error: unknown, fallbackMessage?: string) {
  return resolveKnownGraphQLErrorPresentation(error, fallbackMessage)?.message ?? null;
}

export function resolveKnownGraphQLErrorSupportCode(error: unknown) {
  if (!(error instanceof AppGraphQLError)) {
    return null;
  }

  const policy = GRAPHQL_ERROR_POLICY[error.code];
  return policy?.supportCode ?? null;
}

export function buildErrorSupportCodeDetail(error: unknown) {
  const supportCode = resolveKnownGraphQLErrorSupportCode(error);
  if (!supportCode) {
    return null;
  }

  return UI_COPY.common.error.supportCodeLabel(supportCode);
}

export function resolveKnownGraphQLErrorPresentation(
  error: unknown,
  fallbackMessage?: string
): UserFacingGraphQLErrorPresentation | null {
  if (!(error instanceof AppGraphQLError)) {
    return null;
  }

  const policy = GRAPHQL_ERROR_POLICY[error.code];
  const fallback = fallbackMessage?.trim() || UI_COPY.common.error.serviceUnavailableDescription;
  if (!policy) {
    return {
      message: fallback,
      supportCode: null
    };
  }

  const rawMessage = typeof policy.message === "function" ? policy.message(error) : policy.message;
  const message = typeof rawMessage === "string" && rawMessage.trim() ? rawMessage : fallback;
  return {
    message,
    supportCode: policy.supportCode
  };
}

export function buildErrorToastContent(
  error: unknown,
  fallbackMessage: string,
  overrideMessage?: ReactNode
) {
  return {
    message: overrideMessage ?? resolveKnownGraphQLErrorMessage(error, fallbackMessage) ?? fallbackMessage,
    detail: buildErrorSupportCodeDetail(error) ?? undefined
  };
}

export function captureGraphQLErrorPresentation(source: string, error: unknown, fallbackMessage?: string) {
  if (!(error instanceof AppGraphQLError)) {
    return;
  }

  const presentation = resolveKnownGraphQLErrorPresentation(error, fallbackMessage);
  captureAnalyticsEvent("graphql_error_presented", {
    source,
    error_code: error.code,
    support_code: presentation?.supportCode ?? undefined,
    error_kind: resolveDetailKind(error) ?? undefined,
    expected: EXPECTED_GRAPHQL_ERROR_CODES.has(error.code)
  });
}

export function buildTrackedErrorToastContent(
  source: string,
  error: unknown,
  fallbackMessage: string,
  overrideMessage?: ReactNode
) {
  captureGraphQLErrorPresentation(source, error, fallbackMessage);
  return buildErrorToastContent(error, fallbackMessage, overrideMessage);
}
