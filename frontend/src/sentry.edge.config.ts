import * as Sentry from "@sentry/nextjs";

import { sentryDsn, sentryEnabled, sentryEnvironment } from "@/sentry.shared";

Sentry.init({
  dsn: sentryDsn,
  enabled: sentryEnabled,
  environment: sentryEnvironment
});
