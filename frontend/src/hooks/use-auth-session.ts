"use client";

import { useAuthSessionContext } from "@/components/auth/auth-session-provider";

export function useAuthSession() {
  return useAuthSessionContext();
}
