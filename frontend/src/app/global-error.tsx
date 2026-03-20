"use client";

import { AppErrorScreen } from "@/components/layout/app-error-screen";

import "./globals.css";

export default function GlobalErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <AppErrorScreen error={error} reset={reset} />
      </body>
    </html>
  );
}
