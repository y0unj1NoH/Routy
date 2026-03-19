export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  userId: string;
  email: string | null;
};

export type Place = {
  id: string;
  googlePlaceId: string;
  name: string | null;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: number | null;
  typesRaw: string[];
  primaryType: string | null;
  primaryTypeDisplayName: string | null;
  categories: string[];
  googleMapsUrl: string | null;
  openingHours: unknown;
  photos: string[];
  reviews: Array<{
    authorName?: string | null;
    publishTime?: string | null;
    rating?: number | null;
    text?: string | null;
  }>;
  phone: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlaceListItem = {
  id: string;
  note: string | null;
  isMustVisit: boolean;
  createdAt: string;
  place: Place;
};

export type PlaceList = {
  id: string;
  userId: string;
  name: string;
  city: string;
  language: "ko" | "en";
  description: string | null;
  itemCount: number;
  items: PlaceListItem[];
  createdAt: string;
  updatedAt: string;
};

export type ScheduleStop = {
  id: string;
  stopOrder: number;
  time: string | null;
  label: string | null;
  isMustVisit: boolean;
  note: string | null;
  visitTip: string | null;
  transportToNext: {
    mode?: string;
    distance?: string;
    duration?: string;
  } | null;
  isUserModified: boolean;
  place: Place;
};

export type ScheduleDay = {
  id: string;
  dayNumber: number;
  date: string | null;
  stops: ScheduleStop[];
};

export type ScheduleStayRecommendation = {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  wideSpread: boolean;
};

export type Schedule = {
  id: string;
  userId: string;
  title: string;
  startDate: string;
  endDate: string;
  dayCount: number;
  placeList: PlaceList;
  stayPlace: Place | null;
  stayRecommendation: ScheduleStayRecommendation | null;
  companions: string | null;
  pace: string | null;
  themes: string[];
  outputLanguage: "ko" | "en";
  generationInput: unknown;
  generationVersion: string | null;
  isManualModified: boolean;
  days: ScheduleDay[];
  createdAt: string;
  updatedAt: string;
};

export type CreateScheduleFormValues = {
  title: string;
  startDate: string;
  endDate: string;
  placeListId: string;
  stayMode: "booked" | "unbooked" | null;
  stayPlaceId: string | null;
  companions: string | null;
  pace: string | null;
  themes: string[];
};
