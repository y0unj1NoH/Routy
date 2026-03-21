import { observabilityEnv } from "@/lib/observability-env";

export const sentryDsn = observabilityEnv.sentryDsn || undefined;
export const sentryEnabled = observabilityEnv.sentryEnabled;
export const sentryEnvironment = observabilityEnv.sentryEnvironment;
