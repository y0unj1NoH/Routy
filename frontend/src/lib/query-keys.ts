export const queryKeys = {
  myPlaceLists: ["my-place-lists"] as const,
  placeListDetail: (id: string) => ["place-list-detail", id] as const,
  placeDetail: (id: string) => ["place-detail", id] as const,
  mySchedules: ["my-schedules"] as const,
  scheduleDetail: (id: string) => ["schedule-detail", id] as const
};

