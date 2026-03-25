import { resolveKnownGraphQLErrorMessage } from "@/lib/graphql/error-policy";

export function resolveImportErrorMessage(error: Error, fallbackMessage: string) {
  return resolveKnownGraphQLErrorMessage(error, fallbackMessage) ?? fallbackMessage;
}
