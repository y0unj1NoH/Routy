const { createClient } = require("@supabase/supabase-js");
const { getSupabaseConfig } = require("./env");

function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function resolveSupabaseConfig() {
  const {
    url: supabaseUrl,
    publishableKey,
    secretKey,
    legacyAnonKey,
    legacyServiceRoleKey
  } = getSupabaseConfig();
  const publicKey = publishableKey || legacyAnonKey;
  const privilegedKey = secretKey || legacyServiceRoleKey;

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL");
  }

  return { supabaseUrl, publicKey, privilegedKey };
}

function createClientWithKey({ supabaseUrl, key, authHeader }) {
  if (!key) {
    throw new Error("Missing Supabase API key");
  }

  const headers = authHeader ? { Authorization: authHeader } : {};

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers
    }
  });
}

function createSupabasePublicClient(authHeader) {
  const { supabaseUrl, publicKey } = resolveSupabaseConfig();
  if (!publicKey) {
    throw new Error("Missing SUPABASE_PUBLISHABLE_KEY (or legacy SUPABASE_ANON_KEY) for public operations");
  }
  return createClientWithKey({ supabaseUrl, key: publicKey, authHeader });
}

function createSupabaseAdminClient() {
  const { supabaseUrl, privilegedKey } = resolveSupabaseConfig();
  if (!privilegedKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) for admin operations");
  }
  return createClientWithKey({ supabaseUrl, key: privilegedKey });
}

function createSupabaseClient(authHeader) {
  const { supabaseUrl, publicKey } = resolveSupabaseConfig();
  if (!publicKey) {
    throw new Error("Missing SUPABASE_PUBLISHABLE_KEY (or legacy SUPABASE_ANON_KEY) for request operations");
  }
  const bearerToken = extractBearerToken(authHeader);
  const headerValue = bearerToken ? `Bearer ${bearerToken}` : null;
  return createClientWithKey({ supabaseUrl, key: publicKey, authHeader: headerValue });
}

module.exports = {
  createSupabaseClient,
  createSupabasePublicClient,
  createSupabaseAdminClient,
  extractBearerToken
};
