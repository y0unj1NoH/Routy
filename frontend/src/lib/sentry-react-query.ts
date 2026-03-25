import * as Sentry from "@sentry/nextjs";

import { AppGraphQLError } from "@/lib/graphql/client";
import { isExpectedGraphQLError } from "@/lib/graphql/error-policy";

type ReactQueryOperation = "query" | "mutation";

type ReactQueryErrorContext = {
  key: unknown;
  hash?: string;
  meta?: unknown;
};

const SENTRY_EXTRA_LIMIT = 2_000;

function isExpectedAppError(error: Error) {
  return isExpectedGraphQLError(error);
}

function isAbortError(error: Error) {
  return error.name === "AbortError";
}

function stringifyForSentry(value: unknown) {
  if (typeof value === "undefined") {
    return undefined;
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized.length > SENTRY_EXTRA_LIMIT ? `${serialized.slice(0, SENTRY_EXTRA_LIMIT)}...` : serialized;
  } catch {
    const fallback = String(value);
    return fallback.length > SENTRY_EXTRA_LIMIT ? `${fallback.slice(0, SENTRY_EXTRA_LIMIT)}...` : fallback;
  }
}

function getDetailsKind(details: unknown) {
  if (!details || typeof details !== "object") {
    return undefined;
  }

  const kind = (details as { kind?: unknown }).kind;
  return typeof kind === "string" && kind.trim() ? kind : undefined;
}

function getQueryResourceName(key: unknown) {
  if (Array.isArray(key) && typeof key[0] === "string") {
    return key[0];
  }

  return typeof key === "string" ? key : undefined;
}

function getCurrentPath() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.pathname}${window.location.search}`;
}

export function captureReactQueryError(operation: ReactQueryOperation, error: unknown, context: ReactQueryErrorContext) {
  if (!(error instanceof Error) || isAbortError(error) || isExpectedAppError(error)) {
    return;
  }

  const key = stringifyForSentry(context.key);
  const meta = stringifyForSentry(context.meta);
  const resource = getQueryResourceName(context.key);
  const pathname = getCurrentPath();

  Sentry.withScope((scope) => {
    scope.setTag("error_source", "react-query");
    scope.setTag("react_query.operation", operation);

    if (resource) {
      scope.setTag("react_query.resource", resource);
    }

    if (context.hash) {
      scope.setTag("react_query.hash", context.hash);
    }

    scope.setContext("react_query", {
      operation,
      resource: resource ?? "unknown",
      key: key ?? "unknown",
      hash: context.hash ?? "unknown",
      pathname: pathname ?? "unknown"
    });

    if (meta) {
      scope.setExtra("react_query.meta", meta);
    }

    if (error instanceof AppGraphQLError) {
      const detailsKind = getDetailsKind(error.details);

      scope.setTag("graphql.error_code", error.code);
      if (detailsKind) {
        scope.setTag("graphql.error_kind", detailsKind);
      }

      scope.setContext("graphql", {
        code: error.code,
        status: error.status ?? 0,
        kind: detailsKind ?? null
      });

      const details = stringifyForSentry(error.details);
      if (details) {
        scope.setExtra("graphql.details", details);
      }
    }

    Sentry.captureException(error);
  });
}
