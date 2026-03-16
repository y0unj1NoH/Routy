import type { AuthError } from "@supabase/supabase-js";

import { UI_COPY } from "@/constants/ui-copy";

type AuthFlow = "signIn" | "signUp";
type AuthErrorField = "email" | "password" | "confirmPassword" | "root";

export type AuthErrorMapping = {
  field: AuthErrorField;
  message: string;
};

function normalize(value: string | null | undefined) {
  return (value || "").toLowerCase();
}

export function mapSupabaseAuthError(flow: AuthFlow, error: AuthError | null): AuthErrorMapping {
  if (!error) {
    return {
      field: "root",
      message: flow === "signIn" ? UI_COPY.auth.error.signInProblem : UI_COPY.auth.error.signUpProblem
    };
  }

  const code = normalize(error.code);
  const message = normalize(error.message);

  if (flow === "signIn") {
    if (code.includes("invalid_credentials") || message.includes("invalid login credentials")) {
      return { field: "password", message: UI_COPY.auth.error.invalidCredentials };
    }
    if (message.includes("email not confirmed")) {
      return { field: "email", message: UI_COPY.auth.error.emailNotConfirmed };
    }
    if (message.includes("too many requests")) {
      return { field: "root", message: UI_COPY.auth.error.tooManyRequests };
    }
    return { field: "root", message: UI_COPY.auth.error.signInFailed };
  }

  if (
    code.includes("user_already_exists") ||
    message.includes("already registered") ||
    message.includes("already been registered")
  ) {
    return { field: "email", message: UI_COPY.auth.error.alreadyRegistered };
  }

  if (message.includes("password should be at least")) {
    return { field: "password", message: UI_COPY.common.form.passwordMin };
  }

  return { field: "root", message: UI_COPY.auth.error.signUpFailed };
}
