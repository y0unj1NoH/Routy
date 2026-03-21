const { derivePlaceCategories } = require("./place-semantics");
const { getGooglePlacesApiKey: resolveGooglePlacesApiKeyFromEnv } = require("./env");

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_BASE_URL = "https://places.googleapis.com/v1/places";
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;
const DAYTIME_SERVICE_START_MINUTES = 6 * 60;
const DAYTIME_SERVICE_END_MINUTES = 15 * 60;
const EVENING_OPEN_THRESHOLD_MINUTES = 16 * 60 + 30;
const LATE_CLOSE_THRESHOLD_MINUTES = 22 * 60;
const KNOWN_BUSINESS_STATUS = new Set([
  "OPERATIONAL",
  "CLOSED_TEMPORARILY",
  "CLOSED_PERMANENTLY",
  "FUTURE_OPENING",
  "BUSINESS_STATUS_UNSPECIFIED"
]);
const IMPORT_BLOCKED_BUSINESS_STATUS = new Set(["CLOSED_PERMANENTLY", "FUTURE_OPENING"]);
const UNSCHEDULABLE_BUSINESS_STATUS = new Set([
  "CLOSED_PERMANENTLY",
  "CLOSED_TEMPORARILY",
  "FUTURE_OPENING"
]);
function getGooglePlacesApiKey() {
  return resolveGooglePlacesApiKeyFromEnv();
}

function hasGooglePlacesApiKey() {
  return Boolean(getGooglePlacesApiKey());
}

function ensureGoogleKey() {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    throw new Error("Missing GOOGLE_PLACES_API_KEY (or legacy GOOGLE_MAPS_API_KEY)");
  }
  return apiKey;
}

function toUniqueList(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizePriceLevel(priceLevel, fallbackPriceLevel = null) {
  if (typeof priceLevel === "number" && Number.isFinite(priceLevel)) {
    return Math.max(0, Math.min(4, Math.trunc(priceLevel)));
  }

  if (typeof priceLevel !== "string") {
    return fallbackPriceLevel ?? null;
  }

  const normalized = priceLevel.trim().toUpperCase();
  const byEnum = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
    FREE: 0,
    INEXPENSIVE: 1,
    MODERATE: 2,
    EXPENSIVE: 3,
    VERY_EXPENSIVE: 4
  };

  if (Object.prototype.hasOwnProperty.call(byEnum, normalized)) {
    return byEnum[normalized];
  }

  return fallbackPriceLevel ?? null;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isGoogleMapsHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "maps.app.goo.gl" || host === "goo.gl" || host.endsWith(".google.com");
}

function extractPlaceIdsFromGoogleUrl(rawUrl) {
  const placeIds = [];
  const decoded = safeDecode(rawUrl);

  const placeIdPattern = /place_id[:=]([A-Za-z0-9_-]+)/gi;
  for (const candidate of [rawUrl, decoded]) {
    let match = placeIdPattern.exec(candidate);
    while (match) {
      placeIds.push(match[1]);
      match = placeIdPattern.exec(candidate);
    }
  }

  // Most Google Place IDs start with ChIJ...
  const chiPattern = /ChIJ[0-9A-Za-z_-]{10,}/g;
  for (const candidate of [rawUrl, decoded]) {
    const matches = candidate.match(chiPattern) || [];
    placeIds.push(...matches);
  }

  return toUniqueList(placeIds);
}

function extractSearchTextFromGoogleUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const searchParamCandidates = ["q", "query", "destination", "origin"];
  for (const key of searchParamCandidates) {
    const value = url.searchParams.get(key);
    if (!value || value.toLowerCase().includes("place_id")) continue;
    const normalized = safeDecode(value).replace(/\+/g, " ").trim();
    if (normalized) return normalized;
  }

  const pathname = safeDecode(url.pathname);
  const placePathMatch = pathname.match(/\/maps\/place\/([^/]+)/i);
  if (placePathMatch?.[1]) {
    return placePathMatch[1].replace(/\+/g, " ").trim();
  }

  const searchPathMatch = pathname.match(/\/maps\/search\/([^/]+)/i);
  if (searchPathMatch?.[1]) {
    return searchPathMatch[1].replace(/\+/g, " ").trim();
  }

  return null;
}

function extractNestedGoogleMapsUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const nestedParamKeys = ["url", "u", "link", "continue", "redirect", "redirect_url"];
  for (const key of nestedParamKeys) {
    const value = url.searchParams.get(key);
    if (!value) continue;

    const decodedValue = safeDecode(value);
    try {
      const nestedUrl = new URL(decodedValue);
      if (isGoogleMapsHost(nestedUrl.hostname)) {
        return nestedUrl.toString();
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function expandGoogleMapsUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (!isGoogleMapsHost(parsed.hostname)) {
    return rawUrl;
  }

  try {
    const response = await fetch(rawUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Routy/1.0)"
      }
    });

    return response.url || rawUrl;
  } catch {
    return rawUrl;
  }
}

async function fetchGooglePlacesJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Places API error (${response.status}): ${errorText}`);
  }
  return response.json();
}

async function searchPlacesByText(textQuery, maxResultCount = 5) {
  const apiKey = ensureGoogleKey();
  const body = {
    textQuery,
    maxResultCount
  };

  const data = await fetchGooglePlacesJson(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.formattedAddress"
    },
    body: JSON.stringify(body)
  });

  return data.places || [];
}

async function fetchPlaceDetailsById(placeId) {
  const apiKey = ensureGoogleKey();
  const encodedPlaceId = encodeURIComponent(placeId);
  const url = `${DETAILS_BASE_URL}/${encodedPlaceId}?languageCode=ko`;

  return fetchGooglePlacesJson(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,addressComponents,location,rating,userRatingCount,priceLevel,types,primaryType,businessStatus,regularOpeningHours,photos,websiteUri,googleMapsUri"
    }
  });
}

async function resolveGoogleMapsLink(rawUrl, options = {}) {
  const nestedUrl = extractNestedGoogleMapsUrl(rawUrl);
  const expandedUrl = await expandGoogleMapsUrl(rawUrl);
  const expandedNestedUrl = nestedUrl ? await expandGoogleMapsUrl(nestedUrl) : null;
  const candidates = toUniqueList([
    rawUrl,
    nestedUrl,
    expandedUrl,
    expandedNestedUrl,
    safeDecode(rawUrl),
    safeDecode(nestedUrl),
    safeDecode(expandedUrl),
    safeDecode(expandedNestedUrl)
  ]);

  const placeIds = toUniqueList(candidates.flatMap((candidate) => extractPlaceIdsFromGoogleUrl(candidate)));
  if (placeIds.length > 0) {
    return {
      kind: placeIds.length > 1 ? "LIST" : "PLACE",
      placeIds,
      note: "Resolved from URL tokens",
      query: null
    };
  }

  const query =
    candidates.map((candidate) => extractSearchTextFromGoogleUrl(candidate)).find(Boolean) || null;
  if (query && hasGooglePlacesApiKey()) {
    if (typeof options.onSearchByText === "function") {
      await options.onSearchByText({ query });
    }
    const places = await searchPlacesByText(query, 3);
    const resolvedPlaceIds = toUniqueList((places || []).map((place) => place?.id));
    if (resolvedPlaceIds.length > 0) {
      return {
        kind: resolvedPlaceIds.length > 1 ? "LIST" : "PLACE",
        placeIds: resolvedPlaceIds,
        note: "Resolved via Google text search",
        query
      };
    }
  }

  return {
    kind: "UNRESOLVED",
    placeIds: [],
    note: "No place_id found in URL. For list links, pass explicit place IDs if needed.",
    query: query || null
  };
}

function normalizePlacePayload(googlePlace, fallback = {}) {
  const types = Array.isArray(googlePlace.types) && googlePlace.types.length > 0 ? googlePlace.types : fallback.typesRaw || [];
  const primaryType = googlePlace.primaryType || fallback.primaryType || null;
  const placeName = googlePlace.displayName?.text || fallback.name || null;
  const categories = derivePlaceCategories({
    types,
    primaryType
  });

  return {
    google_place_id: googlePlace.id || fallback.googlePlaceId,
    name: placeName,
    formatted_address: googlePlace.formattedAddress || fallback.formattedAddress || null,
    lat: googlePlace.location?.latitude ?? fallback.lat ?? null,
    lng: googlePlace.location?.longitude ?? fallback.lng ?? null,
    rating: googlePlace.rating ?? fallback.rating ?? null,
    user_rating_count: googlePlace.userRatingCount ?? fallback.userRatingCount ?? null,
    price_level: normalizePriceLevel(googlePlace.priceLevel, fallback.priceLevel),
    types_raw: types,
    primary_type: primaryType,
    business_status: normalizeBusinessStatus(googlePlace.businessStatus || fallback.businessStatus || fallback.business_status),
    address_components: normalizeAddressComponents(
      googlePlace.addressComponents,
      fallback.addressComponents || fallback.address_components
    ),
    categories,
    photos: normalizePhotos(googlePlace.photos, fallback.photos),
    google_maps_url: googlePlace.googleMapsUri || fallback.googleMapsUrl || null,
    opening_hours: googlePlace.regularOpeningHours || fallback.openingHours || null,
    website: googlePlace.websiteUri || fallback.website || null
  };
}

function normalizePhotos(rawPhotos, fallbackPhotos) {
  if (Array.isArray(rawPhotos) && rawPhotos.length > 0) {
    return rawPhotos
      .slice(0, 5)
      .map((photo) => {
        const name = typeof photo?.name === "string" ? photo.name.trim() : "";
        if (!name) return null;
        const attribution = Array.isArray(photo?.authorAttributions) ? photo.authorAttributions[0] || null : null;
        return {
          name,
          displayName:
            typeof attribution?.displayName === "string" && attribution.displayName.trim()
              ? attribution.displayName.trim()
              : null,
          uri: typeof attribution?.uri === "string" && attribution.uri.trim() ? attribution.uri.trim() : null
        };
      })
      .filter(Boolean);
  }

  return Array.isArray(fallbackPhotos) ? fallbackPhotos : [];
}

function normalizeAddressComponents(rawAddressComponents, fallbackAddressComponents) {
  const source = Array.isArray(rawAddressComponents)
    ? rawAddressComponents
    : Array.isArray(fallbackAddressComponents)
      ? fallbackAddressComponents
      : [];

  return source
    .map((component) => {
      const longText = typeof component?.longText === "string" ? component.longText.trim() : "";
      const shortText = typeof component?.shortText === "string" ? component.shortText.trim() : "";
      const types = Array.isArray(component?.types)
        ? [...new Set(component.types.map((type) => String(type || "").trim()).filter(Boolean))]
        : [];

      if (!longText && !shortText && types.length === 0) {
        return null;
      }

      return {
        longText: longText || null,
        shortText: shortText || null,
        types
      };
    })
    .filter(Boolean);
}

function normalizeBusinessStatus(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized || !KNOWN_BUSINESS_STATUS.has(normalized)) {
    return null;
  }
  return normalized === "BUSINESS_STATUS_UNSPECIFIED" ? null : normalized;
}

function isImportBlockedBusinessStatus(value) {
  const normalized = normalizeBusinessStatus(value);
  return normalized ? IMPORT_BLOCKED_BUSINESS_STATUS.has(normalized) : false;
}

function isUnschedulableBusinessStatus(value) {
  const normalized = normalizeBusinessStatus(value);
  return normalized ? UNSCHEDULABLE_BUSINESS_STATUS.has(normalized) : false;
}

function normalizeOpeningPoint(point) {
  if (!point || point.day == null || point.hour == null) return null;

  const day = Number(point.day);
  const hour = Number(point.hour);
  const minute = Number(point.minute ?? 0);
  if (!Number.isFinite(day) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return {
    day: Math.max(0, Math.min(6, Math.trunc(day))),
    hour: Math.max(0, Math.min(23, Math.trunc(hour))),
    minute: Math.max(0, Math.min(59, Math.trunc(minute)))
  };
}

function openingPointToWeekMinutes(point) {
  const normalized = normalizeOpeningPoint(point);
  if (!normalized) return null;
  return normalized.day * MINUTES_PER_DAY + normalized.hour * 60 + normalized.minute;
}

function isAlwaysOpen(openingHours) {
  const descriptions = Array.isArray(openingHours?.weekdayDescriptions) ? openingHours.weekdayDescriptions : [];
  return descriptions.length > 0 && descriptions.every((description) => /24\s*hours|24시간/i.test(String(description)));
}

function extractOpeningIntervals(openingHours) {
  if (!openingHours) return [];
  if (isAlwaysOpen(openingHours)) {
    return [{ start: 0, end: MINUTES_PER_WEEK }];
  }

  const periods = Array.isArray(openingHours?.periods) ? openingHours.periods : [];
  const intervals = [];

  for (const period of periods) {
    const start = openingPointToWeekMinutes(period?.open);
    if (start == null) continue;

    let end = openingPointToWeekMinutes(period?.close);
    if (end == null) {
      intervals.push({ start, end: start + MINUTES_PER_DAY });
      continue;
    }

    if (end <= start) {
      end += MINUTES_PER_WEEK;
    }

    intervals.push({ start, end });
  }

  return intervals.sort((left, right) => left.start - right.start);
}

function getComparableIntervals(interval) {
  if (!interval) return [];
  if (interval.end <= MINUTES_PER_WEEK) {
    return [interval];
  }

  return [
    interval,
    {
      start: interval.start - MINUTES_PER_WEEK,
      end: interval.end - MINUTES_PER_WEEK
    }
  ];
}

function overlapsRange(start, end, rangeStart, rangeEnd) {
  return start < rangeEnd && end > rangeStart;
}

function getOpeningHoursSignals(openingHours) {
  if (!openingHours) {
    return {
      isKnown: false,
      isAlwaysOpen: false,
      hasDaytimeService: false,
      hasEveningOpening: false,
      hasLateClosing: false,
      isEveningOnlyLateService: false
    };
  }

  if (isAlwaysOpen(openingHours)) {
    return {
      isKnown: true,
      isAlwaysOpen: true,
      hasDaytimeService: true,
      hasEveningOpening: true,
      hasLateClosing: true,
      isEveningOnlyLateService: false
    };
  }

  const intervals = extractOpeningIntervals(openingHours);
  if (intervals.length === 0) {
    return {
      isKnown: false,
      isAlwaysOpen: false,
      hasDaytimeService: false,
      hasEveningOpening: false,
      hasLateClosing: false,
      isEveningOnlyLateService: false
    };
  }

  let hasDaytimeService = false;
  let hasEveningOpening = false;
  let hasLateClosing = false;

  for (const interval of intervals) {
    for (const comparableInterval of getComparableIntervals(interval)) {
      const dayStart = Math.floor(comparableInterval.start / MINUTES_PER_DAY) * MINUTES_PER_DAY;
      const dayEnd = dayStart + MINUTES_PER_DAY;
      const localOpenMinutes = comparableInterval.start - dayStart;

      if (localOpenMinutes >= EVENING_OPEN_THRESHOLD_MINUTES) {
        hasEveningOpening = true;
      }

      if (
        comparableInterval.end > dayStart + LATE_CLOSE_THRESHOLD_MINUTES ||
        comparableInterval.end > dayEnd
      ) {
        hasLateClosing = true;
      }

      if (
        overlapsRange(
          comparableInterval.start,
          comparableInterval.end,
          dayStart + DAYTIME_SERVICE_START_MINUTES,
          dayStart + DAYTIME_SERVICE_END_MINUTES
        )
      ) {
        hasDaytimeService = true;
      }

      if (
        comparableInterval.end > dayEnd &&
        overlapsRange(
          comparableInterval.start,
          comparableInterval.end,
          dayEnd + DAYTIME_SERVICE_START_MINUTES,
          dayEnd + DAYTIME_SERVICE_END_MINUTES
        )
      ) {
        hasDaytimeService = true;
      }
    }
  }

  return {
    isKnown: true,
    isAlwaysOpen: false,
    hasDaytimeService,
    hasEveningOpening,
    hasLateClosing,
    isEveningOnlyLateService: !hasDaytimeService && hasEveningOpening && hasLateClosing
  };
}

module.exports = {
  hasGooglePlacesApiKey,
  extractPlaceIdsFromGoogleUrl,
  resolveGoogleMapsLink,
  searchPlacesByText,
  fetchPlaceDetailsById,
  normalizePlacePayload,
  normalizeBusinessStatus,
  isImportBlockedBusinessStatus,
  isUnschedulableBusinessStatus,
  getOpeningHoursSignals
};
