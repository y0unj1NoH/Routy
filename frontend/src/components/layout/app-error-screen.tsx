"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import { UI_COPY } from "@/constants/ui-copy";
import { Mascot } from "@/components/layout/mascot";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type AppErrorScreenProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export function AppErrorScreen({ error, reset }: AppErrorScreenProps) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <PageContainer className="grid min-h-[60dvh] place-items-center">
      <Card className="w-full max-w-xl space-y-4 p-8 text-center">
        <div className="flex justify-center">
          <Mascot variant="surprise" className="h-28 w-28" />
        </div>
        <p className="text-sm font-bold tracking-[0.12em] text-danger">{UI_COPY.systemPages.globalError.eyebrow}</p>
        <h1 className="text-3xl font-black">{UI_COPY.systemPages.globalError.title}</h1>
        <p className="text-sm text-foreground/70">{UI_COPY.systemPages.globalError.description}</p>
        <div className="pt-2">
          <Button size="large" onClick={reset}>
            {UI_COPY.systemPages.globalError.action}
          </Button>
        </div>
      </Card>
    </PageContainer>
  );
}
