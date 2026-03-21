function getTrimmedEnv(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function parseOptionalUrl(name, value) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`Invalid ${name}: expected a valid URL`);
  }
}

function parsePort() {
  const rawPort = getTrimmedEnv("PORT");
  if (!rawPort) {
    return 4000;
  }

  const parsedPort = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error("Invalid PORT: expected an integer between 1 and 65535");
  }

  return parsedPort;
}

function resolveAiProviderPreference() {
  const requestedProvider = getTrimmedEnv("AI_PROVIDER").toLowerCase();

  if (requestedProvider === "gpt" || requestedProvider === "chatgpt") {
    return "openai";
  }

  if (requestedProvider === "gemini" || requestedProvider === "openai") {
    return requestedProvider;
  }

  return "";
}

function getSupabaseConfig() {
  return {
    url: parseOptionalUrl("SUPABASE_URL", getTrimmedEnv("SUPABASE_URL")),
    publishableKey: getTrimmedEnv("SUPABASE_PUBLISHABLE_KEY"),
    secretKey: getTrimmedEnv("SUPABASE_SECRET_KEY"),
    legacyAnonKey: getTrimmedEnv("SUPABASE_ANON_KEY"),
    legacyServiceRoleKey: getTrimmedEnv("SUPABASE_SERVICE_ROLE_KEY")
  };
}

function getGooglePlacesApiKey() {
  return getTrimmedEnv("GOOGLE_PLACES_API_KEY") || getTrimmedEnv("GOOGLE_MAPS_API_KEY");
}

function getGeminiConfig() {
  return {
    apiKey: getTrimmedEnv("GEMINI_API_KEY"),
    model: getTrimmedEnv("GEMINI_MODEL")
  };
}

function getOpenAIConfig() {
  return {
    apiKey: getTrimmedEnv("OPENAI_API_KEY"),
    model: getTrimmedEnv("OPENAI_MODEL")
  };
}

function getOAuthRedirectTo() {
  return parseOptionalUrl("OAUTH_REDIRECT_TO", getTrimmedEnv("OAUTH_REDIRECT_TO"));
}

function getSentryConfig() {
  return {
    dsn: parseOptionalUrl("SENTRY_DSN", getTrimmedEnv("SENTRY_DSN")),
    environment: getTrimmedEnv("SENTRY_ENVIRONMENT", getTrimmedEnv("NODE_ENV", "development"))
  };
}

module.exports = {
  getTrimmedEnv,
  parsePort,
  resolveAiProviderPreference,
  getSupabaseConfig,
  getGooglePlacesApiKey,
  getGeminiConfig,
  getOpenAIConfig,
  getOAuthRedirectTo,
  getSentryConfig
};
