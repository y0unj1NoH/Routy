import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

import { sentryDsn, sentryEnabled, sentryEnvironment } from "@/sentry.shared";
import { observabilityEnv } from "@/lib/observability-env";

Sentry.init({
  dsn: sentryDsn,
  enabled: sentryEnabled,
  environment: sentryEnvironment
});

if (observabilityEnv.posthogEnabled) {
  posthog.init(observabilityEnv.posthogKey, {
    api_host: observabilityEnv.posthogHost,
    defaults: "2026-01-30",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_exceptions: false,
    disable_session_recording: true,
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: {
        email: true,
        password: true,
        search: true,
        tel: true,
        text: true,
        textarea: true,
        url: true
      },
      maskTextSelector: "[data-ph-mask]",
      blockSelector: "[data-ph-no-capture]"
    }
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
