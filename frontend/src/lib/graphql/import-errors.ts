import { UI_COPY } from "@/constants/ui-copy";
import { AppGraphQLError } from "@/lib/graphql/client";

export function resolveImportErrorMessage(error: Error, fallbackMessage: string) {
  if (error instanceof AppGraphQLError && error.code === "IMPORT_LIST_QUOTA_EXCEEDED") {
    return UI_COPY.common.error.importRequestQuotaExceeded;
  }

  if (error instanceof AppGraphQLError && error.code === "IMPORT_PLACE_QUOTA_EXCEEDED") {
    return UI_COPY.common.error.importPlaceQuotaExceeded;
  }

  if (error instanceof AppGraphQLError && (error.code === "BAD_USER_INPUT" || error.code === "NOT_FOUND")) {
    return error.message;
  }

  return fallbackMessage;
}
