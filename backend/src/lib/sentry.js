const { createHash } = require("node:crypto");
const { GraphQLError } = require("graphql");
const Sentry = require("@sentry/node");
const { getSentryConfig } = require("./env");

const EXPECTED_GRAPHQL_ERROR_CODES = new Set([
  "UNAUTHENTICATED",
  "BAD_USER_INPUT",
  "DATE_INPUT_INVALID",
  "PLACE_LIST_SELECTION_INVALID",
  "REGENERATION_INPUT_INVALID",
  "SCHEDULE_STOP_MOVE_INVALID",
  "SCHEDULE_EDIT_INVALID",
  "PLACE_LIST_HAS_SCHEDULES",
  "GOOGLE_MAPS_LIST_LINK_REQUIRED",
  "GOOGLE_MAPS_PLACE_LINK_REQUIRED",
  "GOOGLE_MAPS_LIST_ITEM_LIMIT_EXCEEDED",
  "PLACE_LIST_ITEM_LIMIT_EXCEEDED",
  "IMPORT_LIST_QUOTA_EXCEEDED",
  "IMPORT_PLACE_QUOTA_EXCEEDED",
  "MUST_VISIT_LIMIT_EXCEEDED",
  "AI_CANDIDATE_LIMIT_EXCEEDED",
  "PLACE_LIST_EMPTY_FOR_SCHEDULE",
  "SCHEDULE_NO_SCHEDULABLE_PLACES",
  "SCHEDULE_CANDIDATES_EMPTY_AFTER_PREPROCESS",
  "STAY_PLACE_NOT_IN_LIST",
  "STAY_PLACE_DATA_MISSING",
  "AI_DAILY_QUOTA_EXCEEDED",
  "AI_SYSTEM_MONTHLY_QUOTA_EXCEEDED",
  "TOO_MANY_REQUESTS",
  "NOT_FOUND"
]);

const SENTRY_EXTRA_LIMIT = 2_000;

let isInitialized = false;

function initSentry() {
  if (isInitialized) return;

  const { dsn, environment } = getSentryConfig();

  Sentry.init({
    dsn: dsn || undefined,
    enabled: Boolean(dsn),
    environment
  });

  isInitialized = true;
}

function getGraphQLError(error) {
  if (error instanceof GraphQLError) {
    return error;
  }

  if (error && typeof error === "object" && error.originalError instanceof GraphQLError) {
    return error.originalError;
  }

  return null;
}

function isExpectedGraphQLError(error) {
  const graphQLError = getGraphQLError(error);
  if (!graphQLError) return false;

  const code = typeof graphQLError.extensions?.code === "string" ? graphQLError.extensions.code : "";
  return EXPECTED_GRAPHQL_ERROR_CODES.has(code);
}

function isAbortError(error) {
  return error instanceof Error && error.name === "AbortError";
}

function stringifyForSentry(value) {
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

function getDetailsKind(details) {
  if (!details || typeof details !== "object") {
    return "";
  }

  return typeof details.kind === "string" ? details.kind : "";
}

function hashGraphqlQuery(query) {
  const normalized = typeof query === "string" ? query.trim() : "";
  if (!normalized) return undefined;
  return createHash("sha1").update(normalized).digest("hex").slice(0, 12);
}

function setRequestScope({ method, pathname, search }) {
  if (method) {
    Sentry.setTag("request.method", String(method));
  }

  if (pathname) {
    Sentry.setTag("request.path", String(pathname));
  }

  Sentry.setContext("request", {
    method: method || "unknown",
    pathname: pathname || "unknown",
    search: search || ""
  });
}

function setGraphqlRequestScope(request, params = {}) {
  let pathname = "";
  let search = "";

  try {
    const url = new URL(request.url);
    pathname = url.pathname;
    search = url.search;
  } catch {}

  setRequestScope({
    method: request.method,
    pathname,
    search
  });

  const operationName = typeof params.operationName === "string" ? params.operationName.trim() : "";
  const queryHash = hashGraphqlQuery(params.query);

  if (operationName) {
    Sentry.setTag("graphql.operation_name", operationName);
  }

  if (queryHash) {
    Sentry.setTag("graphql.query_hash", queryHash);
  }

  Sentry.setContext("graphql.request", {
    operationName: operationName || "anonymous",
    queryHash: queryHash || "unknown"
  });
}

async function withSentryRequestIsolation(requestInfo, handler) {
  return Sentry.withIsolationScope(async () => {
    setRequestScope(requestInfo);
    return handler();
  });
}

function setSentryUser(user) {
  if (!user || !user.id) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id,
    email: typeof user.email === "string" ? user.email : undefined
  });
}

function captureBackendException(error, options = {}) {
  if (!(error instanceof Error) || isAbortError(error) || isExpectedGraphQLError(error)) {
    return;
  }

  const graphQLError = getGraphQLError(error);
  const captureTarget = graphQLError?.originalError instanceof Error ? graphQLError.originalError : error;
  const tags = options.tags && typeof options.tags === "object" ? options.tags : {};
  const extras = options.extras && typeof options.extras === "object" ? options.extras : {};
  const source = options.source || "backend";

  Sentry.withScope((scope) => {
    scope.setTag("error_source", source);

    for (const [key, value] of Object.entries(tags)) {
      if (typeof value === "undefined" || value === null || value === "") continue;
      scope.setTag(key, String(value));
    }

    for (const [key, value] of Object.entries(extras)) {
      const serialized = stringifyForSentry(value);
      if (serialized) {
        scope.setExtra(key, serialized);
      }
    }

    if (graphQLError) {
      const code = typeof graphQLError.extensions?.code === "string" ? graphQLError.extensions.code : "UNKNOWN";
      const detailsKind = getDetailsKind(graphQLError.extensions?.details);

      scope.setTag("graphql.error_code", code);
      if (detailsKind) {
        scope.setTag("graphql.error_kind", detailsKind);
      }

      scope.setContext("graphql.error", {
        code,
        kind: detailsKind || null
      });

      const details = stringifyForSentry(graphQLError.extensions?.details);
      if (details) {
        scope.setExtra("graphql.details", details);
      }
    }

    Sentry.captureException(captureTarget);
  });
}

module.exports = {
  initSentry,
  captureBackendException,
  setGraphqlRequestScope,
  setSentryUser,
  withSentryRequestIsolation
};
