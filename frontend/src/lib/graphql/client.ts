"use client";

import { ClientError, GraphQLClient } from "graphql-request";

import { publicEnv } from "@/lib/env";

export type AppGraphQLErrorCode =
  | "UNAUTHENTICATED"
  | "BAD_USER_INPUT"
  | "DATE_INPUT_INVALID"
  | "PLACE_LIST_SELECTION_INVALID"
  | "REGENERATION_INPUT_INVALID"
  | "SCHEDULE_STOP_MOVE_INVALID"
  | "SCHEDULE_EDIT_INVALID"
  | "SCHEDULE_CONFIRMATION_REQUIRED"
  | "PLACE_LIST_HAS_SCHEDULES"
  | "GOOGLE_MAPS_LIST_LINK_REQUIRED"
  | "GOOGLE_MAPS_PLACE_LINK_REQUIRED"
  | "GOOGLE_MAPS_LIST_ITEM_LIMIT_EXCEEDED"
  | "PLACE_LIST_ITEM_LIMIT_EXCEEDED"
  | "IMPORT_LIST_QUOTA_EXCEEDED"
  | "IMPORT_PLACE_QUOTA_EXCEEDED"
  | "MUST_VISIT_LIMIT_EXCEEDED"
  | "AI_CANDIDATE_LIMIT_EXCEEDED"
  | "PLACE_LIST_EMPTY_FOR_SCHEDULE"
  | "SCHEDULE_NO_SCHEDULABLE_PLACES"
  | "SCHEDULE_CANDIDATES_EMPTY_AFTER_PREPROCESS"
  | "STAY_PLACE_NOT_IN_LIST"
  | "STAY_PLACE_DATA_MISSING"
  | "AI_DAILY_QUOTA_EXCEEDED"
  | "AI_SYSTEM_MONTHLY_QUOTA_EXCEEDED"
  | "TOO_MANY_REQUESTS"
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
  if (code === "DATE_INPUT_INVALID") return "DATE_INPUT_INVALID";
  if (code === "PLACE_LIST_SELECTION_INVALID") return "PLACE_LIST_SELECTION_INVALID";
  if (code === "REGENERATION_INPUT_INVALID") return "REGENERATION_INPUT_INVALID";
  if (code === "SCHEDULE_STOP_MOVE_INVALID") return "SCHEDULE_STOP_MOVE_INVALID";
  if (code === "SCHEDULE_EDIT_INVALID") return "SCHEDULE_EDIT_INVALID";
  if (code === "SCHEDULE_CONFIRMATION_REQUIRED") return "SCHEDULE_CONFIRMATION_REQUIRED";
  if (code === "PLACE_LIST_HAS_SCHEDULES") return "PLACE_LIST_HAS_SCHEDULES";
  if (code === "GOOGLE_MAPS_LIST_LINK_REQUIRED") return "GOOGLE_MAPS_LIST_LINK_REQUIRED";
  if (code === "GOOGLE_MAPS_PLACE_LINK_REQUIRED") return "GOOGLE_MAPS_PLACE_LINK_REQUIRED";
  if (code === "GOOGLE_MAPS_LIST_ITEM_LIMIT_EXCEEDED") return "GOOGLE_MAPS_LIST_ITEM_LIMIT_EXCEEDED";
  if (code === "PLACE_LIST_ITEM_LIMIT_EXCEEDED") return "PLACE_LIST_ITEM_LIMIT_EXCEEDED";
  if (code === "IMPORT_LIST_QUOTA_EXCEEDED") return "IMPORT_LIST_QUOTA_EXCEEDED";
  if (code === "IMPORT_PLACE_QUOTA_EXCEEDED") return "IMPORT_PLACE_QUOTA_EXCEEDED";
  if (code === "MUST_VISIT_LIMIT_EXCEEDED") return "MUST_VISIT_LIMIT_EXCEEDED";
  if (code === "AI_CANDIDATE_LIMIT_EXCEEDED") return "AI_CANDIDATE_LIMIT_EXCEEDED";
  if (code === "PLACE_LIST_EMPTY_FOR_SCHEDULE") return "PLACE_LIST_EMPTY_FOR_SCHEDULE";
  if (code === "SCHEDULE_NO_SCHEDULABLE_PLACES") return "SCHEDULE_NO_SCHEDULABLE_PLACES";
  if (code === "SCHEDULE_CANDIDATES_EMPTY_AFTER_PREPROCESS") return "SCHEDULE_CANDIDATES_EMPTY_AFTER_PREPROCESS";
  if (code === "STAY_PLACE_NOT_IN_LIST") return "STAY_PLACE_NOT_IN_LIST";
  if (code === "STAY_PLACE_DATA_MISSING") return "STAY_PLACE_DATA_MISSING";
  if (code === "AI_DAILY_QUOTA_EXCEEDED") return "AI_DAILY_QUOTA_EXCEEDED";
  if (code === "AI_SYSTEM_MONTHLY_QUOTA_EXCEEDED") return "AI_SYSTEM_MONTHLY_QUOTA_EXCEEDED";
  if (code === "TOO_MANY_REQUESTS") return "TOO_MANY_REQUESTS";
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
