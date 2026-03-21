export type ObservabilityAppEnvironment = "local" | "production";

const OBSERVABILITY_APP_ENVIRONMENTS = new Set<ObservabilityAppEnvironment>(["local", "production"]);

function inferObservabilityAppEnvironment(rawValue: string) {
  if (OBSERVABILITY_APP_ENVIRONMENTS.has(rawValue as ObservabilityAppEnvironment)) {
    return rawValue as ObservabilityAppEnvironment;
  }

  if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
    return "production";
  }

  if (process.env.CI === "true" && process.env.NODE_ENV === "production") {
    return "production";
  }

  return "local";
}

function normalizeOptionalUrl(value: string, fallback = "") {
  if (!value) {
    return fallback;
  }

  try {
    return new URL(value).toString();
  } catch {
    return fallback;
  }
}

const rawAppEnvironment = process.env.NEXT_PUBLIC_APP_ENV?.trim() || "";
const appEnvironment = inferObservabilityAppEnvironment(rawAppEnvironment);
const localObservabilityEnabled = (process.env.NEXT_PUBLIC_ENABLE_LOCAL_OBSERVABILITY?.trim() || "") === "1";
const observabilityEnabled = appEnvironment !== "local" || localObservabilityEnabled;

const rawSentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || "";
const rawSentryEnvironment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() || appEnvironment;
const rawPosthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || "";
const rawPosthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

export const observabilityEnv = {
  appEnvironment,
  localObservabilityEnabled,
  observabilityEnabled,
  sentryDsn: normalizeOptionalUrl(rawSentryDsn),
  sentryEnvironment: rawSentryEnvironment,
  sentryEnabled: observabilityEnabled && Boolean(rawSentryDsn),
  posthogKey: rawPosthogKey,
  posthogHost: normalizeOptionalUrl(rawPosthogHost, "https://us.i.posthog.com"),
  posthogEnabled: observabilityEnabled && Boolean(rawPosthogKey)
};
