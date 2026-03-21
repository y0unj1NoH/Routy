import type { Place, PlaceListItem, Schedule, ScheduleDay, ScheduleStop } from "@/types/domain";

export type RouteEditSession = {
  draftSchedule: Schedule;
  workingEditedDayNumbers: number[];
  baselineSaveInputKey: string;
};

export type PendingDeletedStop = {
  stop: ScheduleStop;
  dayNumber: number;
  stopIndex: number;
};

function createClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function uniqueDayNumbers(dayNumbers: number[]) {
  return [...new Set(dayNumbers)].sort((left, right) => left - right);
}

function normalizeStopForEditedDay(stop: ScheduleStop, index: number): ScheduleStop {
  return {
    ...stop,
    stopOrder: index + 1,
    time: null,
    label: null,
    visitTip: null,
    transportToNext: null,
    isUserModified: true
  };
}

function normalizeEditedDay(day: ScheduleDay): ScheduleDay {
  return {
    ...day,
    stops: day.stops.map(normalizeStopForEditedDay)
  };
}

function markDaysEdited(schedule: Schedule, dayNumbers: number[]) {
  const dayNumberSet = new Set(dayNumbers);

  return {
    ...schedule,
    isManualModified: true,
    days: schedule.days.map((day) => (dayNumberSet.has(day.dayNumber) ? normalizeEditedDay(day) : day))
  };
}

function findStopPosition(schedule: Schedule, stopId: string) {
  for (let dayIndex = 0; dayIndex < schedule.days.length; dayIndex += 1) {
    const stopIndex = schedule.days[dayIndex]?.stops.findIndex((stop) => stop.id === stopId) ?? -1;
    if (stopIndex >= 0) {
      return { dayIndex, stopIndex };
    }
  }

  return null;
}

function isPlaceAlreadyUsed(schedule: Schedule, placeId: string) {
  return schedule.days.some((day) => day.stops.some((stop) => stop.place.id === placeId));
}

function appendPlaceListItem(schedule: Schedule, item: PlaceListItem): Schedule {
  const alreadyExists = schedule.placeList.items.some(
    (candidate) => candidate.id === item.id || candidate.place.id === item.place.id
  );
  if (alreadyExists) {
    return schedule;
  }

  return {
    ...schedule,
    placeList: {
      ...schedule.placeList,
      itemCount: schedule.placeList.itemCount + 1,
      items: [...schedule.placeList.items, item]
    }
  };
}

function buildDraftStopFromPlaceItem(item: PlaceListItem): ScheduleStop {
  return {
    id: createClientId("draft-stop"),
    stopOrder: 1,
    time: null,
    label: null,
    isMustVisit: Boolean(item.isMustVisit),
    note: item.note ?? null,
    visitTip: null,
    transportToNext: null,
    isUserModified: true,
    place: item.place
  };
}

export function cloneSchedule(schedule: Schedule): Schedule {
  return structuredClone(schedule);
}

export function getPersistedEditedDayNumbers(schedule: Schedule) {
  return schedule.isManualModified ? schedule.days.map((day) => day.dayNumber) : [];
}

export function createRouteEditSession(schedule: Schedule): RouteEditSession {
  return {
    draftSchedule: cloneSchedule(schedule),
    workingEditedDayNumbers: getPersistedEditedDayNumbers(schedule),
    baselineSaveInputKey: buildSaveScheduleEditsKey(schedule)
  };
}

export function moveRouteEditStop(
  session: RouteEditSession,
  stopId: string,
  direction: "up" | "down"
): RouteEditSession {
  const schedule = cloneSchedule(session.draftSchedule);
  const position = findStopPosition(schedule, stopId);
  if (!position) {
    return session;
  }

  const day = schedule.days[position.dayIndex];
  const targetIndex = direction === "up" ? position.stopIndex - 1 : position.stopIndex + 1;
  if (targetIndex < 0 || targetIndex >= day.stops.length) {
    return session;
  }

  const reorderedStops = [...day.stops];
  const [movingStop] = reorderedStops.splice(position.stopIndex, 1);
  reorderedStops.splice(targetIndex, 0, movingStop);
  schedule.days[position.dayIndex] = { ...day, stops: reorderedStops };

  return {
    draftSchedule: markDaysEdited(schedule, [day.dayNumber]),
    workingEditedDayNumbers: uniqueDayNumbers([...session.workingEditedDayNumbers, day.dayNumber]),
    baselineSaveInputKey: session.baselineSaveInputKey
  };
}

export function moveRouteEditStopToDay(
  session: RouteEditSession,
  stopId: string,
  targetDayNumber: number
): RouteEditSession {
  const schedule = cloneSchedule(session.draftSchedule);
  const position = findStopPosition(schedule, stopId);
  if (!position) {
    return session;
  }

  const sourceDay = schedule.days[position.dayIndex];
  const targetDayIndex = schedule.days.findIndex((day) => day.dayNumber === targetDayNumber);
  if (targetDayIndex < 0) {
    return session;
  }

  const targetDay = schedule.days[targetDayIndex];
  if (targetDay.dayNumber === sourceDay.dayNumber) {
    return session;
  }

  const sourceStops = [...sourceDay.stops];
  const [movingStop] = sourceStops.splice(position.stopIndex, 1);
  const targetStops = [...targetDay.stops, movingStop];

  schedule.days[position.dayIndex] = { ...sourceDay, stops: sourceStops };
  schedule.days[targetDayIndex] = { ...targetDay, stops: targetStops };

  const editedDayNumbers = [sourceDay.dayNumber, targetDay.dayNumber];

  return {
    draftSchedule: markDaysEdited(schedule, editedDayNumbers),
    workingEditedDayNumbers: uniqueDayNumbers([...session.workingEditedDayNumbers, ...editedDayNumbers]),
    baselineSaveInputKey: session.baselineSaveInputKey
  };
}

export function deleteRouteEditStop(session: RouteEditSession, stopId: string): RouteEditSession {
  const schedule = cloneSchedule(session.draftSchedule);
  const position = findStopPosition(schedule, stopId);
  if (!position) {
    return session;
  }

  const day = schedule.days[position.dayIndex];
  schedule.days[position.dayIndex] = { ...day, stops: day.stops.filter((stop) => stop.id !== stopId) };

  return {
    draftSchedule: markDaysEdited(schedule, [day.dayNumber]),
    workingEditedDayNumbers: uniqueDayNumbers([...session.workingEditedDayNumbers, day.dayNumber]),
    baselineSaveInputKey: session.baselineSaveInputKey
  };
}

export function restoreRouteEditStop(
  session: RouteEditSession,
  pendingDeletedStop: PendingDeletedStop
): RouteEditSession {
  const schedule = cloneSchedule(session.draftSchedule);
  const targetDayIndex = schedule.days.findIndex((day) => day.dayNumber === pendingDeletedStop.dayNumber);
  if (targetDayIndex < 0) {
    return session;
  }

  if (isPlaceAlreadyUsed(schedule, pendingDeletedStop.stop.place.id)) {
    return session;
  }

  const targetDay = schedule.days[targetDayIndex];
  const restoredStops = [...targetDay.stops];
  const safeTargetIndex = Math.max(0, Math.min(pendingDeletedStop.stopIndex, restoredStops.length));
  restoredStops.splice(safeTargetIndex, 0, pendingDeletedStop.stop);
  schedule.days[targetDayIndex] = { ...targetDay, stops: restoredStops };

  return {
    draftSchedule: markDaysEdited(schedule, [targetDay.dayNumber]),
    workingEditedDayNumbers: uniqueDayNumbers([...session.workingEditedDayNumbers, targetDay.dayNumber]),
    baselineSaveInputKey: session.baselineSaveInputKey
  };
}

export function addRouteEditPlace(
  session: RouteEditSession,
  item: PlaceListItem,
  targetDayNumber: number
): RouteEditSession {
  const schedule = cloneSchedule(session.draftSchedule);
  const targetDayIndex = schedule.days.findIndex((day) => day.dayNumber === targetDayNumber);
  if (targetDayIndex < 0 || isPlaceAlreadyUsed(schedule, item.place.id)) {
    return session;
  }

  const targetDay = schedule.days[targetDayIndex];
  schedule.days[targetDayIndex] = {
    ...targetDay,
    stops: [...targetDay.stops, buildDraftStopFromPlaceItem(item)]
  };

  return {
    draftSchedule: markDaysEdited(schedule, [targetDay.dayNumber]),
    workingEditedDayNumbers: uniqueDayNumbers([...session.workingEditedDayNumbers, targetDay.dayNumber]),
    baselineSaveInputKey: session.baselineSaveInputKey
  };
}

export function addRouteEditGooglePlace(
  session: RouteEditSession,
  item: PlaceListItem,
  targetDayNumber: number
): RouteEditSession {
  return addRouteEditPlace(
    {
      ...session,
      draftSchedule: appendPlaceListItem(session.draftSchedule, item)
    },
    item,
    targetDayNumber
  );
}

export function appendRouteEditPlaceListItem(schedule: Schedule, item: PlaceListItem) {
  return appendPlaceListItem(schedule, item);
}

export function createDraftPlaceListItem(place: Place, input?: { note?: string | null; isMustVisit?: boolean }): PlaceListItem {
  return {
    id: createClientId("draft-place-list-item"),
    note: input?.note ?? null,
    isMustVisit: Boolean(input?.isMustVisit),
    createdAt: new Date().toISOString(),
    place
  };
}

export function buildSaveScheduleEditsInput(schedule: Schedule) {
  return {
    days: schedule.days.map((day) => ({
      dayNumber: day.dayNumber,
      stops: day.stops.map((stop) => ({
        placeId: stop.place.id,
        note: stop.note ?? null,
        isMustVisit: Boolean(stop.isMustVisit)
      }))
    }))
  };
}

function buildSaveScheduleEditsKey(schedule: Schedule) {
  return JSON.stringify(buildSaveScheduleEditsInput(schedule));
}

export function hasRouteEditChanges(session: RouteEditSession) {
  return buildSaveScheduleEditsKey(session.draftSchedule) !== session.baselineSaveInputKey;
}
