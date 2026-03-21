"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { UI_COPY } from "@/constants/ui-copy";
import { isSupabaseEnvConfigured, publicEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export type BrowserSessionPersistence = "session" | "local";

const AUTH_STORAGE_KEY = "routy.auth.token";
const AUTH_CODE_VERIFIER_STORAGE_KEY = `${AUTH_STORAGE_KEY}-code-verifier`;
const AUTH_PERSISTENCE_MARKER_KEY = "routy.auth.persistence";
const AUTH_OAUTH_RETURN_PERSISTENCE_KEY = "routy.auth.oauth.return.persistence";
const LEGACY_AUTH_STORAGE_KEY = getLegacyProjectAuthStorageKey();
const LEGACY_CODE_VERIFIER_STORAGE_KEY = LEGACY_AUTH_STORAGE_KEY ? `${LEGACY_AUTH_STORAGE_KEY}-code-verifier` : null;

type BrowserStorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function canUseWindow() {
  return typeof window !== "undefined";
}

function getLegacyProjectAuthStorageKey() {
  if (!isSupabaseEnvConfigured) return null;

  try {
    const hostname = new URL(publicEnv.supabaseUrl).hostname;
    const projectRef = hostname.split(".")[0]?.trim();
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

function getStorage(mode: BrowserSessionPersistence) {
  if (!canUseWindow()) return null;
  return mode === "local" ? window.localStorage : window.sessionStorage;
}

function safeGet(storage: Storage | null, key: string) {
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage | null, key: string, value: string) {
  if (!storage) return;

  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage quota / availability issues and let auth fail naturally if needed.
  }
}

function safeRemove(storage: Storage | null, key: string) {
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage availability issues.
  }
}

function getLegacyKeysForKey(key: string) {
  if (key === AUTH_STORAGE_KEY) {
    return [LEGACY_AUTH_STORAGE_KEY, "supabase.auth.token"].filter(Boolean) as string[];
  }

  if (key === AUTH_CODE_VERIFIER_STORAGE_KEY) {
    return [LEGACY_CODE_VERIFIER_STORAGE_KEY, "supabase.auth.token-code-verifier"].filter(Boolean) as string[];
  }

  return [];
}

function getRelatedKeys(key: string) {
  return [key, ...getLegacyKeysForKey(key)];
}

function setStoredPersistenceMode(mode: BrowserSessionPersistence) {
  safeRemove(getStorage("session"), AUTH_PERSISTENCE_MARKER_KEY);
  safeRemove(getStorage("local"), AUTH_PERSISTENCE_MARKER_KEY);
  safeSet(getStorage(mode), AUTH_PERSISTENCE_MARKER_KEY, mode);
}

function clearStoredPersistenceMode() {
  safeRemove(getStorage("session"), AUTH_PERSISTENCE_MARKER_KEY);
  safeRemove(getStorage("local"), AUTH_PERSISTENCE_MARKER_KEY);
}

function setStoredOAuthReturnPersistence(mode: BrowserSessionPersistence) {
  safeRemove(getStorage("session"), AUTH_OAUTH_RETURN_PERSISTENCE_KEY);
  safeSet(getStorage("local"), AUTH_OAUTH_RETURN_PERSISTENCE_KEY, mode);
}

function clearStoredOAuthReturnPersistence() {
  safeRemove(getStorage("session"), AUTH_OAUTH_RETURN_PERSISTENCE_KEY);
  safeRemove(getStorage("local"), AUTH_OAUTH_RETURN_PERSISTENCE_KEY);
}

function getStoredPersistenceMode(): BrowserSessionPersistence | null {
  const sessionMode = safeGet(getStorage("session"), AUTH_PERSISTENCE_MARKER_KEY);
  if (sessionMode === "session") return "session";

  const localMode = safeGet(getStorage("local"), AUTH_PERSISTENCE_MARKER_KEY);
  if (localMode === "local") return "local";

  return null;
}

function getStoredOAuthReturnPersistence(): BrowserSessionPersistence | null {
  const value = safeGet(getStorage("local"), AUTH_OAUTH_RETURN_PERSISTENCE_KEY);
  return value === "local" || value === "session" ? value : null;
}

function migrateLegacyValue(storage: Storage | null, sourceKey: string, targetKey: string, value: string) {
  if (!storage || sourceKey === targetKey) return value;

  safeSet(storage, targetKey, value);
  safeRemove(storage, sourceKey);
  return value;
}

function readValueForMode(mode: BrowserSessionPersistence, key: string) {
  const storage = getStorage(mode);
  const directValue = safeGet(storage, key);
  if (directValue !== null) {
    return directValue;
  }

  for (const legacyKey of getLegacyKeysForKey(key)) {
    const legacyValue = safeGet(storage, legacyKey);
    if (legacyValue !== null) {
      return migrateLegacyValue(storage, legacyKey, key, legacyValue);
    }
  }

  return null;
}

function detectPersistenceFromStoredValue(key: string) {
  for (const mode of ["session", "local"] as const) {
    const value = readValueForMode(mode, key);
    if (value !== null) {
      setStoredPersistenceMode(mode);
      return value;
    }
  }

  return null;
}

function clearStoredKeyEverywhere(key: string) {
  for (const relatedKey of getRelatedKeys(key)) {
    safeRemove(getStorage("session"), relatedKey);
    safeRemove(getStorage("local"), relatedKey);
  }
}

function moveStoredKeyToMode(key: string, mode: BrowserSessionPersistence) {
  const targetStorage = getStorage(mode);
  const inactiveStorage = getStorage(mode === "local" ? "session" : "local");
  const value = readValueForMode(mode, key) ?? readValueForMode(mode === "local" ? "session" : "local", key);

  for (const relatedKey of getRelatedKeys(key)) {
    safeRemove(inactiveStorage, relatedKey);
  }

  for (const legacyKey of getLegacyKeysForKey(key)) {
    safeRemove(targetStorage, legacyKey);
  }

  if (value !== null) {
    safeSet(targetStorage, key, value);
    return;
  }

  safeRemove(targetStorage, key);
}

const browserStorage: BrowserStorageAdapter = {
  getItem(key) {
    const storedMode = getStoredPersistenceMode();
    if (storedMode) {
      return readValueForMode(storedMode, key);
    }

    return detectPersistenceFromStoredValue(key);
  },

  setItem(key, value) {
    const mode = getStoredPersistenceMode() ?? "session";
    const activeStorage = getStorage(mode);
    const inactiveStorage = getStorage(mode === "local" ? "session" : "local");

    for (const relatedKey of getRelatedKeys(key)) {
      safeRemove(inactiveStorage, relatedKey);
    }

    for (const legacyKey of getLegacyKeysForKey(key)) {
      safeRemove(activeStorage, legacyKey);
    }

    safeSet(activeStorage, key, value);
    setStoredPersistenceMode(mode);
  },

  removeItem(key) {
    for (const relatedKey of getRelatedKeys(key)) {
      safeRemove(getStorage("session"), relatedKey);
      safeRemove(getStorage("local"), relatedKey);
    }

    if (key === AUTH_STORAGE_KEY) {
      clearStoredPersistenceMode();
    }
  }
};

export function getMissingSupabaseEnvMessage() {
  return UI_COPY.auth.serviceConfigError;
}

export function setSupabaseBrowserSessionPersistence(mode: BrowserSessionPersistence) {
  setStoredPersistenceMode(mode);
}

export function prepareSupabaseBrowserOAuthRedirectPersistence(mode: BrowserSessionPersistence) {
  setStoredOAuthReturnPersistence(mode);
  setStoredPersistenceMode("local");
}

export function finalizeSupabaseBrowserOAuthRedirectPersistence() {
  const intendedMode = getStoredOAuthReturnPersistence();
  if (!intendedMode) return;

  moveStoredKeyToMode(AUTH_STORAGE_KEY, intendedMode);
  clearStoredKeyEverywhere(AUTH_CODE_VERIFIER_STORAGE_KEY);
  setStoredPersistenceMode(intendedMode);
  clearStoredOAuthReturnPersistence();
}

export function cancelSupabaseBrowserOAuthRedirectPersistence() {
  const intendedMode = getStoredOAuthReturnPersistence();
  if (!intendedMode) return;

  clearStoredKeyEverywhere(AUTH_CODE_VERIFIER_STORAGE_KEY);
  setStoredPersistenceMode(intendedMode);
  clearStoredOAuthReturnPersistence();
}

export function clearSupabaseBrowserAuthStorage() {
  for (const key of [AUTH_STORAGE_KEY, AUTH_CODE_VERIFIER_STORAGE_KEY]) {
    clearStoredKeyEverywhere(key);
  }

  clearStoredPersistenceMode();
  clearStoredOAuthReturnPersistence();
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseEnvConfigured) {
    throw new Error(getMissingSupabaseEnvMessage());
  }

  if (!browserClient) {
    browserClient = createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        flowType: "pkce",
        storageKey: AUTH_STORAGE_KEY,
        storage: browserStorage,
        // OAuth callback page handles `exchangeCodeForSession` explicitly.
        // Keep URL session auto-detection off to avoid stale URL parsing warnings.
        detectSessionInUrl: false
      }
    });
  }
  return browserClient;
}
