const { createClient } = require("@supabase/supabase-js");

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
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const legacyAnonKey = process.env.SUPABASE_ANON_KEY;
  const legacyServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
  const { supabaseUrl, publicKey, privilegedKey } = resolveSupabaseConfig();
  const selectedKey = publicKey || privilegedKey;
  return createClientWithKey({ supabaseUrl, key: selectedKey, authHeader });
}

function createSupabaseAdminClient() {
  const { supabaseUrl, privilegedKey } = resolveSupabaseConfig();
  if (!privilegedKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) for admin operations");
  }
  return createClientWithKey({ supabaseUrl, key: privilegedKey });
}

function createSupabaseClient(authHeader) {
  const { supabaseUrl, publicKey, privilegedKey } = resolveSupabaseConfig();
  const bearerToken = extractBearerToken(authHeader);
  const key = bearerToken ? publicKey || privilegedKey : privilegedKey || publicKey;
  const headerValue = bearerToken ? `Bearer ${bearerToken}` : null;
  return createClientWithKey({ supabaseUrl, key, authHeader: headerValue });
}

module.exports = {
  createSupabaseClient,
  createSupabasePublicClient,
  createSupabaseAdminClient,
  extractBearerToken
};
