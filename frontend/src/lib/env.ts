export type PublicAppEnvironment = "local" | "production";

const PUBLIC_APP_ENVIRONMENTS = new Set<PublicAppEnvironment>(["local", "production"]);

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

// Next.js only exposes client env when the access is a static `process.env.NEXT_PUBLIC_*` read.
const rawAppEnvironment = process.env.NEXT_PUBLIC_APP_ENV?.trim() || "";
const appEnvironment = inferPublicAppEnvironment();
const requiresDeployedEnv = appEnvironment !== "local";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const rawSupabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const rawAuthCallbackUrl = process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL?.trim() || "";
const rawGraphqlEndpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT?.trim() || (appEnvironment === "local" ? "http://localhost:4000/graphql" : "");
const rawGoogleMapsEmbedBase = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_BASE?.trim() || "https://www.google.com/maps";
const rawGoogleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
const rawSentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || "";
const rawSentryEnvironment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() || appEnvironment;
const rawPosthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || "";
const rawPosthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
const localObservabilityEnabled = (process.env.NEXT_PUBLIC_ENABLE_LOCAL_OBSERVABILITY?.trim() || "") === "1";
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
