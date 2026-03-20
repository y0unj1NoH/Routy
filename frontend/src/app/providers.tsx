"use client";

import { useState, type ReactNode } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { AuthSessionProvider } from "@/components/auth/auth-session-provider";
import { captureReactQueryError } from "@/lib/sentry-react-query";

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
      <AuthSessionProvider>{children}</AuthSessionProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
