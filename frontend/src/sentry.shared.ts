import { publicEnv } from "@/lib/env";

export const sentryDsn = publicEnv.sentryDsn || undefined;
export const sentryEnabled = Boolean(publicEnv.sentryDsn);
export const sentryEnvironment = publicEnv.sentryEnvironment;
