"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuthSession } from "@/hooks/use-auth-session";

type UseRequireAuthOptions = {
  redirectUnauthed?: boolean;
};

export function useRequireAuth(options: UseRequireAuthOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading } = useAuthSession();
  const redirectUnauthed = options.redirectUnauthed ?? true;

  useEffect(() => {
    if (!redirectUnauthed) return;
    if (isLoading) return;
    if (session) return;

    const rawSearch = typeof window !== "undefined" ? window.location.search : "";
    const nextPath = `${pathname}${rawSearch}`;
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [isLoading, session, router, pathname, redirectUnauthed]);

  return {
    session,
    isLoading,
    isAuthed: Boolean(session)
  };
}
