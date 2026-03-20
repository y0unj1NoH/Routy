const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const rawSupabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const rawAuthCallbackUrl = process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL?.trim() || "";
const rawSentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || "";
const rawSentryEnvironment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development";

export const publicEnv = {
  supabaseUrl: rawSupabaseUrl,
  supabasePublishableKey: rawSupabasePublishableKey,
  authCallbackUrl: rawAuthCallbackUrl,
  graphqlEndpoint: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql",
  googleMapsEmbedBase: process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_BASE || "https://www.google.com/maps",
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  sentryDsn: rawSentryDsn,
  sentryEnvironment: rawSentryEnvironment
};

export const isSupabaseEnvConfigured = Boolean(rawSupabaseUrl && rawSupabasePublishableKey);
export const isEnvConfigured = isSupabaseEnvConfigured;
