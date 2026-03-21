"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppAnalyticsRuntime } from "@/components/analytics/app-analytics-runtime";
import { AuthSessionProvider } from "@/components/auth/auth-session-provider";
import { captureReactQueryError } from "@/lib/sentry-react-query";

const ReactQueryDevtools =
  process.env.NODE_ENV === "development"
    ? dynamic(
        () =>
          import("@tanstack/react-query-devtools").then((module) => ({
            default: module.ReactQueryDevtools
          })),
        { ssr: false }
      )
    : () => null;

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            captureReactQueryError("query", error, {
              key: query.queryKey,
              hash: query.queryHash,
              meta: query.meta
            });
          }
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            captureReactQueryError("mutation", error, {
              key: mutation.options.mutationKey,
              meta: mutation.options.meta
            });
          }
        }),
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppAnalyticsRuntime />
      <AuthSessionProvider>{children}</AuthSessionProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
