"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingPanel } from "@/components/common/loading-panel";
import { UI_COPY } from "@/constants/ui-copy";
import { PageContainer } from "@/components/layout/page-container";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
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
        console.error({ oauthError, oauthErrorDescription });
        pushToast({
          kind: "error",
          message: UI_COPY.auth.error.callbackFailed
        });
        router.replace("/login");
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error(exchangeError);
            pushToast({
              kind: "error",
              message: UI_COPY.auth.error.callbackFailed
            });
            router.replace("/login");
            return;
          }
        }

        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          console.error(error);
          pushToast({
            kind: "error",
            message: UI_COPY.auth.error.callbackFailed
          });
          router.replace("/login");
          return;
        }

        router.replace(next);
      } catch (error) {
        console.error(error);
        pushToast({
          kind: "error",
          message: UI_COPY.auth.error.callbackFailed
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
