"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingPanel } from "@/components/common/loading-panel";
import { UI_COPY } from "@/constants/ui-copy";
import { PageContainer } from "@/components/layout/page-container";
import { captureAnalyticsEvent } from "@/lib/analytics";
import { mapOAuthCallbackError } from "@/lib/supabase/auth-errors";
import {
  cancelSupabaseBrowserOAuthRedirectPersistence,
  finalizeSupabaseBrowserOAuthRedirectPersistence,
  getSupabaseBrowserClient
} from "@/lib/supabase/browser";
import { useUiStore } from "@/stores/ui-store";

export default function AuthCallbackPage() {
  const router = useRouter();
  const pushToast = useUiStore((state) => state.pushToast);

  useEffect(() => {
    async function handleAuthCallback() {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/";
      const oauthError = params.get("error");
      const oauthErrorDescription = params.get("error_description");
      const code = params.get("code");

      if (oauthError) {
        cancelSupabaseBrowserOAuthRedirectPersistence();
        console.error({ oauthError, oauthErrorDescription });
        pushToast({
          kind: "error",
          message: mapOAuthCallbackError({ oauthError, oauthErrorDescription })
        });
        router.replace("/login");
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            cancelSupabaseBrowserOAuthRedirectPersistence();
            console.error(exchangeError);
            pushToast({
              kind: "error",
              message: mapOAuthCallbackError({ exchangeError })
            });
            router.replace("/login");
            return;
          }
        }

        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          cancelSupabaseBrowserOAuthRedirectPersistence();
          console.error(error);
          pushToast({
            kind: "error",
            message: mapOAuthCallbackError({ exchangeError: error })
          });
          router.replace("/login");
          return;
        }

        finalizeSupabaseBrowserOAuthRedirectPersistence();
        captureAnalyticsEvent("auth_login_succeeded", {
          method: "google",
          destination_path: next
        });
        router.replace(next);
      } catch (error) {
        cancelSupabaseBrowserOAuthRedirectPersistence();
        console.error(error);
        pushToast({
          kind: "error",
          message: mapOAuthCallbackError({
            exchangeError: error instanceof Error ? { message: error.message } : null
          })
        });
        router.replace("/login");
      }
    }

    handleAuthCallback();
  }, [pushToast, router]);

  return (
    <PageContainer>
      <LoadingPanel message={UI_COPY.auth.callback.loading} />
    </PageContainer>
  );
}
