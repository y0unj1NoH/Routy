"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { UI_COPY } from "@/constants/ui-copy";
import { isSupabaseEnvConfigured, publicEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export type BrowserSessionPersistence = "session" | "local";

const AUTH_STORAGE_KEY = "myroute.auth.token";
const AUTH_CODE_VERIFIER_STORAGE_KEY = `${AUTH_STORAGE_KEY}-code-verifier`;
const AUTH_PERSISTENCE_MARKER_KEY = "myroute.auth.persistence";
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

function getStoredPersistenceMode(): BrowserSessionPersistence | null {
  const sessionMode = safeGet(getStorage("session"), AUTH_PERSISTENCE_MARKER_KEY);
  if (sessionMode === "session") return "session";

  const localMode = safeGet(getStorage("local"), AUTH_PERSISTENCE_MARKER_KEY);
  if (localMode === "local") return "local";

  return null;
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

export function clearSupabaseBrowserAuthStorage() {
  for (const key of [AUTH_STORAGE_KEY, AUTH_CODE_VERIFIER_STORAGE_KEY]) {
    for (const relatedKey of getRelatedKeys(key)) {
      safeRemove(getStorage("session"), relatedKey);
      safeRemove(getStorage("local"), relatedKey);
    }
  }

  clearStoredPersistenceMode();
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
