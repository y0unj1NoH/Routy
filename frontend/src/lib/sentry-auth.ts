"use client";

import * as Sentry from "@sentry/nextjs";

import { UI_COPY } from "@/constants/ui-copy";

type AuthEntryPage = "login" | "signup";
type AuthResponseFlow = "signIn" | "signUp";
type AuthIssueKind =
  | "missing_supabase_env"
  | "unexpected_auth_response"
  | "unexpected_auth_exception"
  | "oauth_init_failure";

type AuthScopeOptions = {
  page: AuthEntryPage;
  stage: string;
  issueKind: AuthIssueKind;
  error: unknown;
  mappedMessage?: string;
  tags?: Record<string, string | undefined>;
  extras?: Record<string, unknown>;
  fingerprint?: string[];
};

type AuthConfigIssueDetails = {
  supabaseUrlConfigured: boolean;
  supabasePublishableKeyConfigured: boolean;
};

const AUTH_ENTRY_SESSION_KEY_PREFIX = "routy.auth-entry.sentry";

function canUseWindow() {
  return typeof window !== "undefined";
}

function getCurrentPath() {
  if (!canUseWindow()) {
    return undefined;
  }

  return `${window.location.pathname}${window.location.search}`;
}

function buildSessionKey(page: AuthEntryPage, issueKind: AuthIssueKind) {
  return `${AUTH_ENTRY_SESSION_KEY_PREFIX}:${page}:${issueKind}`;
}

function hasReportedSessionIssue(key: string) {
  if (!canUseWindow()) {
    return false;
  }

  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markSessionIssueReported(key: string) {
  if (!canUseWindow()) {
    return;
  }

  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Ignore storage availability problems and keep best-effort Sentry reporting.
  }
}

function normalizeError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}

function captureAuthIssue(options: AuthScopeOptions) {
  const error = normalizeError(options.error, `Auth entry issue at ${options.page}:${options.stage}`);
  const pathname = getCurrentPath();

  Sentry.withScope((scope) => {
    scope.setTag("error_source", "auth-entry");
    scope.setTag("auth.page", options.page);
    scope.setTag("auth.stage", options.stage);
    scope.setTag("auth.issue_kind", options.issueKind);

    for (const [key, value] of Object.entries(options.tags || {})) {
      if (!value) continue;
      scope.setTag(key, value);
    }

    if (options.fingerprint?.length) {
      scope.setFingerprint(options.fingerprint);
    }

    scope.setContext("auth", {
      page: options.page,
      stage: options.stage,
      issueKind: options.issueKind,
      pathname: pathname || "unknown",
      mappedMessage: options.mappedMessage || null
    });

    for (const [key, value] of Object.entries(options.extras || {})) {
      if (typeof value === "undefined") continue;
      scope.setExtra(key, value);
    }

    Sentry.captureException(error);
  });
}

export function reportAuthConfigIssueOnce(page: AuthEntryPage, details: AuthConfigIssueDetails) {
  const sessionKey = buildSessionKey(page, "missing_supabase_env");
  if (hasReportedSessionIssue(sessionKey)) {
    return;
  }

  captureAuthIssue({
    page,
    stage: "page_load",
    issueKind: "missing_supabase_env",
    error: new Error(`Auth entry blocked on ${page}: Supabase public env is not configured`),
    fingerprint: ["auth-entry", page, "missing_supabase_env"],
    extras: details
  });

  markSessionIssueReported(sessionKey);
}

export function shouldCaptureSupabaseAuthError(flow: AuthResponseFlow, mappedMessage: string) {
  if (flow === "signIn") {
    return !(<string[]>[
      UI_COPY.auth.error.invalidCredentials,
      UI_COPY.auth.error.emailNotConfirmed,
      UI_COPY.auth.error.tooManyRequests
    ]).includes(mappedMessage);
  }

  return !(<string[]>[UI_COPY.auth.error.alreadyRegistered, UI_COPY.common.form.passwordMin]).includes(mappedMessage);
}

export function shouldCaptureGoogleOAuthInitError(mappedMessage: string) {
  return mappedMessage !== UI_COPY.auth.error.oauthCancelled;
}

export function captureAuthResponseError(options: {
  page: AuthEntryPage;
  stage: string;
  error: unknown;
  mappedMessage: string;
  flow?: AuthResponseFlow;
  fingerprintKey: string;
  tags?: Record<string, string | undefined>;
}) {
  captureAuthIssue({
    page: options.page,
    stage: options.stage,
    issueKind: options.flow ? "unexpected_auth_response" : "oauth_init_failure",
    error: options.error,
    mappedMessage: options.mappedMessage,
    fingerprint: ["auth-entry", options.page, options.fingerprintKey],
    tags: {
      "auth.flow": options.flow,
      ...options.tags
    }
  });
}

export function captureAuthException(options: {
  page: AuthEntryPage;
  stage: string;
  error: unknown;
  flow?: AuthResponseFlow;
  tags?: Record<string, string | undefined>;
}) {
  captureAuthIssue({
    page: options.page,
    stage: options.stage,
    issueKind: "unexpected_auth_exception",
    error: options.error,
    fingerprint: ["auth-entry", options.page, options.stage, "exception"],
    tags: {
      "auth.flow": options.flow,
      ...options.tags
    }
  });
}
