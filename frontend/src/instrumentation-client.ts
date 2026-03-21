import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

import { sentryDsn, sentryEnabled, sentryEnvironment } from "@/sentry.shared";
import { publicEnv } from "@/lib/env";

Sentry.init({
  dsn: sentryDsn,
  enabled: sentryEnabled,
  environment: sentryEnvironment
});

if (publicEnv.posthogEnabled) {
  posthog.init(publicEnv.posthogKey, {
    api_host: publicEnv.posthogHost,
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
