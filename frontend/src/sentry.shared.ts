import { publicEnv } from "@/lib/env";

export const sentryDsn = publicEnv.sentryDsn || undefined;
export const sentryEnabled = publicEnv.sentryEnabled;
export const sentryEnvironment = publicEnv.sentryEnvironment;
