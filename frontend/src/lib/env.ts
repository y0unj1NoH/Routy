export type PublicAppEnvironment = "local" | "production";

const PUBLIC_APP_ENVIRONMENTS = new Set<PublicAppEnvironment>(["local", "production"]);

function getTrimmedEnv(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function throwInvalidEnv(name: string, message: string): never {
  throw new Error(`[public env] ${name} ${message}`);
}

function ensureRequiredEnv(name: string, value: string, reason: string) {
  if (!value) {
    throwInvalidEnv(name, reason);
  }

  return value;
}

function ensureUrlEnv(name: string, value: string, options?: { required?: boolean; reason?: string }) {
  if (!value) {
    if (options?.required) {
      throwInvalidEnv(name, options.reason || "is required.");
    }

    return value;
  }

  try {
    return new URL(value).toString();
  } catch {
    throwInvalidEnv(name, "must be a valid URL.");
  }
}

function parsePublicAppEnvironment(value: string) {
  if (PUBLIC_APP_ENVIRONMENTS.has(value as PublicAppEnvironment)) {
    return value as PublicAppEnvironment;
  }

  throwInvalidEnv("NEXT_PUBLIC_APP_ENV", "must be one of: local, production.");
}

function inferPublicAppEnvironment() {
  const rawAppEnvironment = getTrimmedEnv("NEXT_PUBLIC_APP_ENV");
  if (rawAppEnvironment) {
    return parsePublicAppEnvironment(rawAppEnvironment);
  }

  // When the app is deployed, treat it as production-like unless the env is explicitly marked local.
  if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
    return "production";
  }

  if (process.env.CI === "true" && process.env.NODE_ENV === "production") {
    return "production";
  }

  return "local";
}

const appEnvironment = inferPublicAppEnvironment();
const requiresDeployedEnv = appEnvironment !== "local";

const rawSupabaseUrl = getTrimmedEnv("NEXT_PUBLIC_SUPABASE_URL");
const rawSupabasePublishableKey =
  getTrimmedEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || getTrimmedEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const rawAuthCallbackUrl = getTrimmedEnv("NEXT_PUBLIC_AUTH_CALLBACK_URL");
const rawGraphqlEndpoint = getTrimmedEnv(
  "NEXT_PUBLIC_GRAPHQL_ENDPOINT",
  appEnvironment === "local" ? "http://localhost:4000/graphql" : ""
);
const rawGoogleMapsEmbedBase = getTrimmedEnv("NEXT_PUBLIC_GOOGLE_MAPS_EMBED_BASE", "https://www.google.com/maps");
const rawGoogleMapsApiKey = getTrimmedEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
const rawSentryDsn = getTrimmedEnv("NEXT_PUBLIC_SENTRY_DSN");
const rawSentryEnvironment = getTrimmedEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", appEnvironment);
const rawPosthogKey = getTrimmedEnv("NEXT_PUBLIC_POSTHOG_KEY");
const rawPosthogHost = getTrimmedEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
const localObservabilityEnabled = getTrimmedEnv("NEXT_PUBLIC_ENABLE_LOCAL_OBSERVABILITY") === "1";
const observabilityEnabled = appEnvironment !== "local" || localObservabilityEnabled;

const supabaseUrl = ensureUrlEnv("NEXT_PUBLIC_SUPABASE_URL", rawSupabaseUrl, {
  required: requiresDeployedEnv,
  reason: "is required when NEXT_PUBLIC_APP_ENV is production."
});
const supabasePublishableKey = requiresDeployedEnv
  ? ensureRequiredEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      rawSupabasePublishableKey,
      "is required when NEXT_PUBLIC_APP_ENV is production."
    )
  : rawSupabasePublishableKey;
const authCallbackUrl = ensureUrlEnv("NEXT_PUBLIC_AUTH_CALLBACK_URL", rawAuthCallbackUrl, {
  required: requiresDeployedEnv,
  reason: "is required when NEXT_PUBLIC_APP_ENV is production."
});
const graphqlEndpoint = ensureUrlEnv("NEXT_PUBLIC_GRAPHQL_ENDPOINT", rawGraphqlEndpoint, {
  required: requiresDeployedEnv,
  reason: "is required when NEXT_PUBLIC_APP_ENV is production."
});
const googleMapsEmbedBase = ensureUrlEnv("NEXT_PUBLIC_GOOGLE_MAPS_EMBED_BASE", rawGoogleMapsEmbedBase, {
  required: true,
  reason: "must not be empty."
});
const sentryDsn = ensureUrlEnv("NEXT_PUBLIC_SENTRY_DSN", rawSentryDsn);
const posthogHost = ensureUrlEnv("NEXT_PUBLIC_POSTHOG_HOST", rawPosthogHost, {
  required: true,
  reason: "must not be empty."
});

export const publicEnv = {
  appEnvironment,
  localObservabilityEnabled,
  observabilityEnabled,
  supabaseUrl,
  supabasePublishableKey,
  authCallbackUrl,
  graphqlEndpoint,
  googleMapsEmbedBase,
  googleMapsApiKey: rawGoogleMapsApiKey,
  sentryDsn,
  sentryEnvironment: rawSentryEnvironment,
  sentryEnabled: observabilityEnabled && Boolean(sentryDsn),
  posthogKey: rawPosthogKey,
  posthogHost,
  posthogEnabled: observabilityEnabled && Boolean(rawPosthogKey && posthogHost)
};

export const isLocalAppEnvironment = publicEnv.appEnvironment === "local";
export const isSupabaseEnvConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabasePublishableKey);
export const isEnvConfigured = isSupabaseEnvConfigured;
