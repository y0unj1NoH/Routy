"use client";

import { ClientError, GraphQLClient } from "graphql-request";

import { publicEnv } from "@/lib/env";

export type AppGraphQLErrorCode =
  | "UNAUTHENTICATED"
  | "BAD_USER_INPUT"
  | "NOT_FOUND"
  | "INTERNAL_SERVER_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export class AppGraphQLError extends Error {
  readonly code: AppGraphQLErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, options: { code?: AppGraphQLErrorCode; status?: number; details?: unknown } = {}) {
    super(message);
    this.code = options.code || "UNKNOWN";
    this.status = options.status;
    this.details = options.details;
  }
}

function normalizeCode(code: string | undefined): AppGraphQLErrorCode {
  if (!code) return "UNKNOWN";
  if (code === "UNAUTHENTICATED") return "UNAUTHENTICATED";
  if (code === "BAD_USER_INPUT") return "BAD_USER_INPUT";
  if (code === "NOT_FOUND") return "NOT_FOUND";
  if (code === "INTERNAL_SERVER_ERROR") return "INTERNAL_SERVER_ERROR";
  return "UNKNOWN";
}

function mapClientError(error: ClientError) {
  const firstError = error.response.errors?.[0];
  const extensions = (firstError?.extensions || {}) as {
    code?: string;
    details?: unknown;
  };

  return new AppGraphQLError(firstError?.message || error.message, {
    code: normalizeCode(extensions.code),
    status: error.response.status,
    details: extensions.details
  });
}

export async function gqlRequest<TData, TVariables extends Record<string, unknown> = Record<string, unknown>>(
  document: string,
  variables: TVariables,
  accessToken?: string
) {
  const client = new GraphQLClient(publicEnv.graphqlEndpoint, {
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`
        }
      : {}
  });

  try {
    return await client.request<TData>(document, variables as Record<string, never>);
  } catch (error) {
    if (error instanceof ClientError) {
      throw mapClientError(error);
    }
    if (error instanceof Error) {
      throw new AppGraphQLError(error.message || "Network error", { code: "NETWORK_ERROR" });
    }
    throw error;
  }
}
