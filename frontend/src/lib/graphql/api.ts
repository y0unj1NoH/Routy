"use client";

import {
  ADD_PLACE_LIST_ITEM_MUTATION,
  CREATE_SCHEDULE_MUTATION,
  DELETE_PLACE_LIST_MUTATION,
  DELETE_MY_ACCOUNT_MUTATION,
  DELETE_SCHEDULE_MUTATION,
  IMPORT_PLACE_FROM_GOOGLE_LINK_MUTATION,
  IMPORT_PLACE_LIST_FROM_CRAWLER_MUTATION,
  MOVE_SCHEDULE_STOP_MUTATION,
  MY_PLACE_LISTS_QUERY,
  MY_SCHEDULES_QUERY,
  PLACE_DETAIL_QUERY,
  PLACE_LIST_DETAIL_QUERY,
  REGENERATE_SCHEDULE_MUTATION,
  REMOVE_PLACE_LIST_ITEM_MUTATION,
  SCHEDULE_DETAIL_QUERY,
  UPDATE_SCHEDULE_STOP_MUTATION,
  UPDATE_PLACE_LIST_ITEM_MUTATION,
  UPDATE_PLACE_LIST_MUTATION
} from "@/lib/graphql/documents";
import { gqlRequest } from "@/lib/graphql/client";
import type { Place, PlaceList, Schedule } from "@/types/domain";

type PlaceListPreview = Pick<PlaceList, "id" | "userId" | "name" | "city" | "language" | "description" | "itemCount" | "createdAt" | "updatedAt"> & {
  previewPlaces: Array<Pick<Place, "id" | "name" | "photos">>;
};

export async function fetchMyPlaceLists(accessToken: string) {
  const data = await gqlRequest<{ myPlaceLists: PlaceListPreview[] }, { limit: number; offset: number }>(
    MY_PLACE_LISTS_QUERY,
    { limit: 100, offset: 0 },
    accessToken
  );
  return data.myPlaceLists;
}

export async function fetchPlaceListDetail(id: string, accessToken: string) {
  const data = await gqlRequest<{ placeList: PlaceList | null }, { id: string }>(
    PLACE_LIST_DETAIL_QUERY,
    { id },
    accessToken
  );
  return data.placeList;
}

export async function fetchPlaceDetail(id: string, accessToken: string) {
  const data = await gqlRequest<{ place: Place | null }, { id: string }>(PLACE_DETAIL_QUERY, { id }, accessToken);
  return data.place;
}

export async function fetchMySchedules(accessToken: string) {
  const data = await gqlRequest<{ mySchedules: Schedule[] }, { limit: number; offset: number }>(
    MY_SCHEDULES_QUERY,
    { limit: 100, offset: 0 },
    accessToken
  );
  return data.mySchedules;
}

export async function fetchScheduleDetail(id: string, accessToken: string) {
  const data = await gqlRequest<{ schedule: Schedule | null }, { id: string }>(SCHEDULE_DETAIL_QUERY, { id }, accessToken);
  return data.schedule;
}

export async function updatePlaceList(
  accessToken: string,
  id: string,
  input: {
    name?: string;
    city?: string;
    language?: "ko" | "en";
    description?: string | null;
  }
) {
  const data = await gqlRequest<{ updatePlaceList: PlaceList }, { id: string; input: typeof input }>(
    UPDATE_PLACE_LIST_MUTATION,
    { id, input },
    accessToken
  );
  return data.updatePlaceList;
}

export async function updatePlaceListItem(
  accessToken: string,
  id: string,
  input: {
    note?: string | null;
    isMustVisit?: boolean;
  }
) {
  await gqlRequest<{ updatePlaceListItem: { id: string } }, { id: string; input: typeof input }>(
    UPDATE_PLACE_LIST_ITEM_MUTATION,
    { id, input },
    accessToken
  );
}

export async function removePlaceListItem(accessToken: string, id: string) {
  const data = await gqlRequest<{ removePlaceListItem: boolean }, { id: string }>(
    REMOVE_PLACE_LIST_ITEM_MUTATION,
    { id },
    accessToken
  );
  return data.removePlaceListItem;
}

export async function addPlaceListItem(
  accessToken: string,
  input: {
    listId: string;
    placeId: string;
    note?: string | null;
    isMustVisit?: boolean;
  }
) {
  const data = await gqlRequest<{ addPlaceListItem: { id: string } }, { input: typeof input }>(
    ADD_PLACE_LIST_ITEM_MUTATION,
    { input },
    accessToken
  );
  return data.addPlaceListItem;
}

export async function deletePlaceList(accessToken: string, id: string) {
  const data = await gqlRequest<{ deletePlaceList: boolean }, { id: string }>(
    DELETE_PLACE_LIST_MUTATION,
    { id },
    accessToken
  );
  return data.deletePlaceList;
}

export async function importPlaceListFromCrawler(
  accessToken: string,
  input: { url: string; listName: string; city: string }
) {
  const data = await gqlRequest<{ importPlaceListFromCrawler: PlaceList }, { url: string; listName: string; city: string }>(
    IMPORT_PLACE_LIST_FROM_CRAWLER_MUTATION,
    input,
    accessToken
  );
  return data.importPlaceListFromCrawler;
}

export async function importPlaceFromGoogleLink(accessToken: string, url: string) {
  const data = await gqlRequest<{ importPlaceFromGoogleLink: Place[] }, { url: string }>(
    IMPORT_PLACE_FROM_GOOGLE_LINK_MUTATION,
    { url },
    accessToken
  );
  return data.importPlaceFromGoogleLink;
}

export async function createSchedule(
  accessToken: string,
  input: {
    title: string;
    startDate: string;
    endDate: string;
    placeListId: string;
    stayPlaceId?: string | null;
    companions?: string | null;
    pace?: string | null;
    themes?: string[];
    outputLanguage?: "ko" | "en";
  }
) {
  const data = await gqlRequest<{ createSchedule: { id: string } }, { input: typeof input }>(
    CREATE_SCHEDULE_MUTATION,
    { input },
    accessToken
  );
  return data.createSchedule;
}

export async function moveScheduleStop(
  accessToken: string,
  scheduleId: string,
  input: {
    stopId: string;
    targetDayNumber: number;
    targetOrder: number;
  }
) {
  await gqlRequest<{ moveScheduleStop: { id: string } }, { scheduleId: string; input: typeof input }>(
    MOVE_SCHEDULE_STOP_MUTATION,
    { scheduleId, input },
    accessToken
  );
}

export async function updateScheduleStopNote(
  accessToken: string,
  scheduleId: string,
  input: {
    stopId: string;
    note?: string | null;
  }
) {
  await gqlRequest<{ updateScheduleStop: { id: string } }, { scheduleId: string; input: typeof input }>(
    UPDATE_SCHEDULE_STOP_MUTATION,
    { scheduleId, input },
    accessToken
  );
}

export async function regenerateSchedule(accessToken: string, scheduleId: string) {
  const data = await gqlRequest<{ regenerateSchedule: { id: string } }, { scheduleId: string; input: Record<string, never> }>(
    REGENERATE_SCHEDULE_MUTATION,
    { scheduleId, input: {} },
    accessToken
  );
  return data.regenerateSchedule;
}

export async function deleteSchedule(accessToken: string, id: string) {
  const data = await gqlRequest<{ deleteSchedule: boolean }, { id: string }>(DELETE_SCHEDULE_MUTATION, { id }, accessToken);
  return data.deleteSchedule;
}

export async function deleteMyAccount(accessToken: string) {
  const data = await gqlRequest<{ deleteMyAccount: boolean }, Record<string, never>>(
    DELETE_MY_ACCOUNT_MUTATION,
    {},
    accessToken
  );
  return data.deleteMyAccount;
}
