"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UI_COPY } from "@/constants/ui-copy";
import { PageContainer } from "@/components/layout/page-container";
import { PageTitle } from "@/components/common/page-title";
import { AuthPageBrand } from "@/components/auth/auth-page-brand";
import { captureAnalyticsEvent } from "@/lib/analytics";
import { safeZodResolver } from "@/lib/forms/safe-zod-resolver";
import { mapSupabaseAuthError } from "@/lib/supabase/auth-errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUiStore } from "@/stores/ui-store";

const signupSchema = z
  .object({
    email: z.string().email(UI_COPY.common.form.validEmail),
    password: z.string().min(6, UI_COPY.common.form.passwordMin),
    confirmPassword: z.string().min(6, UI_COPY.common.form.confirmPassword)
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: UI_COPY.common.form.passwordMismatch,
    path: ["confirmPassword"]
  });

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const pushToast = useUiStore((state) => state.pushToast);

  const form = useForm<SignupValues>({
    resolver: safeZodResolver(signupSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: ""
    }
  });

  const onSubmit = form.handleSubmit(async (values) => {
    captureAnalyticsEvent("auth_signup_submitted", {
      method: "password"
    });
    form.clearErrors("root");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password
      });

      if (error) {
        const mapped = mapSupabaseAuthError("signUp", error);
        if (mapped.field === "root") {
          form.setError("root", { type: "server", message: mapped.message });
        } else {
          form.setError(mapped.field, { type: "server", message: mapped.message });
        }
        pushToast({ kind: "error", message: mapped.message });
        return;
      }

      captureAnalyticsEvent("auth_signup_succeeded", {
        method: "password"
      });
      pushToast({ kind: "success", message: UI_COPY.auth.signup.success });
      router.replace("/login");
    } catch (error) {
      console.error(error);
      const message = UI_COPY.auth.error.signUpGeneric;
      form.setError("root", { type: "server", message });
      pushToast({ kind: "error", message });
    }
  });

  return (
    <PageContainer className="grid min-h-dvh place-items-center pt-0 pb-0 md:pb-0">
      <section className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-5 shadow-surface md:rounded-2xl md:p-6">
        <div className="space-y-3 md:space-y-4">
          <AuthPageBrand />
          <PageTitle title={UI_COPY.auth.signup.title} className="text-center" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {form.formState.errors.root?.message ? (
            <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-semibold md:text-sm">
              {UI_COPY.auth.signup.emailLabel}
            </label>
            <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
            <p className="text-xs text-danger">{form.formState.errors.email?.message}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-semibold md:text-sm">
              {UI_COPY.auth.signup.passwordLabel}
            </label>
            <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
            <p className="text-xs text-danger">{form.formState.errors.password?.message}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-xs font-semibold md:text-sm">
              {UI_COPY.auth.signup.confirmPasswordLabel}
            </label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...form.register("confirmPassword")}
            />
            <p className="text-xs text-danger">{form.formState.errors.confirmPassword?.message}</p>
          </div>

          <Button type="submit" fullWidth size="large" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? UI_COPY.auth.signup.submitting : UI_COPY.auth.signup.submit}
          </Button>
        </form>

        <p className="text-center text-sm text-foreground/70">
          {UI_COPY.auth.signup.prompt}{" "}
          <Link href="/login" className="font-semibold text-primary">
            {UI_COPY.auth.signup.promptAction}
          </Link>
        </p>
      </section>
    </PageContainer>
  );
}

