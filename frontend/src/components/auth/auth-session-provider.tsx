"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

import { isSupabaseEnvConfigured } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthSessionContextValue = {
  session: Session | null;
  isLoading: boolean;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseEnvConfigured) {
      setIsLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let isMounted = true;

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data.session);
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      Sentry.setUser(null);
      return;
    }

    Sentry.setUser({
      id: session.user.id,
      email: session.user.email ?? undefined
    });
  }, [session]);

  return <AuthSessionContext.Provider value={{ session, isLoading }}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSessionContext() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSessionContext must be used within AuthSessionProvider");
  }

  return context;
}
