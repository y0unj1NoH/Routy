import { UI_COPY } from "@/constants/ui-copy";
import { AppGraphQLError } from "@/lib/graphql/client";

export function resolveAiScheduleQuotaMessage(error: Error) {
  if (error instanceof AppGraphQLError && error.code === "AI_DAILY_QUOTA_EXCEEDED") {
    return UI_COPY.common.error.aiDailyQuotaExceeded;
  }

  if (error instanceof AppGraphQLError && error.code === "AI_SYSTEM_MONTHLY_QUOTA_EXCEEDED") {
    return UI_COPY.common.error.aiMonthlyQuotaExceeded;
  }

  return null;
}
