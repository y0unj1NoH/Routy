"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UI_COPY } from "@/constants/ui-copy";
import { PageContainer } from "@/components/layout/page-container";
import { PageTitle } from "@/components/common/page-title";
import { AuthPageBrand } from "@/components/auth/auth-page-brand";
import { captureAnalyticsEvent } from "@/lib/analytics";
import { isSupabaseEnvConfigured, publicEnv } from "@/lib/env";
import { safeZodResolver } from "@/lib/forms/safe-zod-resolver";
import { mapGoogleOAuthInitError, mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import {
  cancelSupabaseBrowserOAuthRedirectPersistence,
  getMissingSupabaseEnvMessage,
  getSupabaseBrowserClient,
  prepareSupabaseBrowserOAuthRedirectPersistence,
  setSupabaseBrowserSessionPersistence
} from "@/lib/supabase/browser";
import { useUiStore } from "@/stores/ui-store";

const loginSchema = z.object({
  email: z.string().email(UI_COPY.common.form.validEmail),
  password: z.string().min(6, UI_COPY.common.form.passwordMin)
});

type LoginValues = z.infer<typeof loginSchema>;
type AuthMethod = "password" | "google";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.72-.06-1.25-.19-1.8H12v3.48h5.52c-.11.86-.7 2.15-2.02 3.02l-.02.12 2.84 2.2.2.02c1.82-1.68 2.88-4.14 2.88-7.04Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.89 6.61-2.42l-3.15-2.44c-.84.59-1.97 1-3.46 1-2.65 0-4.89-1.74-5.7-4.15l-.11.01-2.95 2.29-.04.11C4.84 19.66 8.13 22 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.3 14c-.21-.59-.33-1.23-.33-1.9s.12-1.31.32-1.9l-.01-.13-2.99-2.33-.1.05A9.95 9.95 0 0 0 2 12.1c0 1.59.38 3.09 1.06 4.41L6.3 14Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.88 0 3.15.81 3.88 1.48l2.83-2.76C16.95 3.09 14.7 2 12 2 8.13 2 4.84 4.34 3.2 7.69l3.1 2.41c.82-2.41 3.06-4.14 5.7-4.14Z"
      />
    </svg>
  );
}

function buildAuthCallbackUrl(nextPath: string) {
  const callbackBase = publicEnv.authCallbackUrl || `${window.location.origin}/auth/callback`;
  const redirectUrl = new URL(callbackBase);
  redirectUrl.searchParams.set("next", nextPath);
  return redirectUrl.toString();
}

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [activeAuthMethod, setActiveAuthMethod] = useState<AuthMethod | null>(null);
  const activeAuthMethodRef = useRef<AuthMethod | null>(null);
  const pushToast = useUiStore((state) => state.pushToast);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get("next") || "/");
  }, []);

  const form = useForm<LoginValues>({
    resolver: safeZodResolver(loginSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const lockAuthAttempt = (method: AuthMethod) => {
    if (activeAuthMethodRef.current) {
      return false;
    }

    activeAuthMethodRef.current = method;
    setActiveAuthMethod(method);
    return true;
  };

  const releaseAuthAttempt = () => {
    activeAuthMethodRef.current = null;
    setActiveAuthMethod(null);
  };

  const isAuthBusy = activeAuthMethod !== null;
  const isPasswordSubmitting = activeAuthMethod === "password";

  const onSubmit = form.handleSubmit(async (values) => {
    if (!lockAuthAttempt("password")) {
      return;
    }

    captureAnalyticsEvent("auth_login_submitted", {
      method: "password",
      destination_path: nextPath
    });
    form.clearErrors("root");

    try {
      setSupabaseBrowserSessionPersistence(keepSignedIn ? "local" : "session");
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password
      });

      if (error) {
        const mapped = mapSupabaseAuthError("signIn", error);
        if (mapped.field === "root") {
          form.setError("root", { type: "server", message: mapped.message });
        } else if (mapped.field === "email" || mapped.field === "password") {
          form.setError(mapped.field, { type: "server", message: mapped.message });
        } else {
          form.setError("root", { type: "server", message: mapped.message });
        }
        pushToast({ kind: "error", message: mapped.message });
        return;
      }

      captureAnalyticsEvent("auth_login_succeeded", {
        method: "password",
        destination_path: nextPath
      });
      pushToast({ kind: "success", message: UI_COPY.auth.login.success });
      router.replace(nextPath);
    } catch (error) {
      console.error(error);
      const message = UI_COPY.auth.error.signInGeneric;
      form.setError("root", { type: "server", message });
      pushToast({ kind: "error", message });
    } finally {
      releaseAuthAttempt();
    }
  });

  const handleGoogleSignIn = async () => {
    if (!lockAuthAttempt("google")) {
      return;
    }

    captureAnalyticsEvent("auth_login_submitted", {
      method: "google",
      destination_path: nextPath
    });
    form.clearErrors("root");

    try {
      if (!isSupabaseEnvConfigured) {
        const message = getMissingSupabaseEnvMessage();
        form.setError("root", { type: "server", message });
        pushToast({ kind: "error", message });
        return;
      }

      prepareSupabaseBrowserOAuthRedirectPersistence(keepSignedIn ? "local" : "session");
      const supabase = getSupabaseBrowserClient();
      const redirectTo = buildAuthCallbackUrl(nextPath);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo }
      });

      if (error) {
        cancelSupabaseBrowserOAuthRedirectPersistence();
        console.error(error);
        const message = mapGoogleOAuthInitError(error);
        form.setError("root", { type: "server", message });
        pushToast({ kind: "error", message });
      }
    } catch (error) {
      cancelSupabaseBrowserOAuthRedirectPersistence();
      console.error(error);
      const message = UI_COPY.auth.error.googleFailed;
      form.setError("root", { type: "server", message });
      pushToast({ kind: "error", message });
    } finally {
      releaseAuthAttempt();
    }
  };

  return (
    <PageContainer className="grid min-h-dvh place-items-center pt-0 pb-0 md:pb-0">
      <section className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-5 shadow-surface md:rounded-2xl md:p-6">
        <div className="space-y-3 md:space-y-4">
          <AuthPageBrand />
          <PageTitle title={UI_COPY.auth.login.title} className="text-center" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4" aria-busy={isAuthBusy}>
          {form.formState.errors.root?.message ? (
            <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-semibold md:text-sm">
              {UI_COPY.auth.login.emailLabel}
            </label>
            <Input id="email" type="email" autoComplete="email" disabled={isAuthBusy} {...form.register("email")} />
            <p className="text-xs text-danger">{form.formState.errors.email?.message}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-semibold md:text-sm">
              {UI_COPY.auth.login.passwordLabel}
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              disabled={isAuthBusy}
              {...form.register("password")}
            />
            <p className="text-xs text-danger">{form.formState.errors.password?.message}</p>
          </div>

          <label
            htmlFor="keepSignedIn"
            className="inline-flex w-fit cursor-pointer select-none items-center gap-2 text-xs font-semibold text-foreground touch-manipulation [-webkit-tap-highlight-color:transparent] md:text-sm"
          >
            <input
              id="keepSignedIn"
              type="checkbox"
              checked={keepSignedIn}
              disabled={isAuthBusy}
              onChange={(event) => setKeepSignedIn(event.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border border-border bg-card/92 text-transparent shadow-inset-field transition-[border-color,box-shadow,background-color,color] duration-200 peer-focus-visible:border-primary-light peer-focus-visible:ring-4 peer-focus-visible:ring-primary/15 peer-checked:border-transparent peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-none peer-disabled:opacity-50"
            >
              <Check className="h-3 w-3" strokeWidth={3.5} />
            </span>
            {UI_COPY.auth.login.rememberLabel}
          </label>

          <Button type="submit" fullWidth size="large" disabled={isAuthBusy}>
            {isPasswordSubmitting ? UI_COPY.auth.login.submitting : UI_COPY.auth.login.submit}
          </Button>
        </form>

        <Button
          variant="secondary"
          fullWidth
          size="large"
          onClick={handleGoogleSignIn}
          disabled={!isSupabaseEnvConfigured || isAuthBusy}
        >
          <span className="inline-flex items-center gap-2">
            <GoogleMark />
            <span>{UI_COPY.auth.login.google}</span>
          </span>
        </Button>

        <p className="text-center text-sm text-foreground/70">
          {UI_COPY.auth.login.prompt}{" "}
          <Link href="/signup" className="font-semibold text-primary">
            {UI_COPY.auth.login.promptAction}
          </Link>
        </p>
      </section>
    </PageContainer>
  );
}

