const { PLACE_CATEGORY } = require("./route-taxonomy");

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_BASE_URL = "https://places.googleapis.com/v1/places";

function getGooglePlacesApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
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
        "User-Agent": "Mozilla/5.0 (compatible; myRoute/1.0)"
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
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri"
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
        "id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,types,primaryType,regularOpeningHours,photos,reviews,nationalPhoneNumber,websiteUri,googleMapsUri"
    }
  });
}

async function resolveGoogleMapsLink(rawUrl) {
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
  const primaryType = googlePlace.primaryType || null;

  return {
    google_place_id: googlePlace.id || fallback.googlePlaceId,
    name: googlePlace.displayName?.text || fallback.name || null,
    formatted_address: googlePlace.formattedAddress || fallback.formattedAddress || null,
    lat: googlePlace.location?.latitude ?? fallback.lat ?? null,
    lng: googlePlace.location?.longitude ?? fallback.lng ?? null,
    rating: googlePlace.rating ?? fallback.rating ?? null,
    user_rating_count: googlePlace.userRatingCount ?? fallback.userRatingCount ?? null,
    price_level: normalizePriceLevel(googlePlace.priceLevel, fallback.priceLevel),
    types_raw: types,
    category: inferCategory(types, primaryType, fallback.category),
    photos: normalizePhotos(googlePlace.photos, fallback.photos),
    reviews: normalizeReviews(googlePlace.reviews, fallback.reviews),
    google_maps_url: googlePlace.googleMapsUri || fallback.googleMapsUrl || null,
    opening_hours: googlePlace.regularOpeningHours || fallback.openingHours || null,
    phone: googlePlace.nationalPhoneNumber || fallback.phone || null,
    website: googlePlace.websiteUri || fallback.website || null
  };
}

function normalizePhotos(rawPhotos, fallbackPhotos) {
  if (Array.isArray(rawPhotos) && rawPhotos.length > 0) {
    return rawPhotos
      .slice(0, 5)
      .map((photo) => photo?.name)
      .filter(Boolean)
      .map((name) => `https://places.googleapis.com/v1/${name}/media?maxWidthPx=800`);
  }

  return Array.isArray(fallbackPhotos) ? fallbackPhotos : [];
}

function normalizeReviews(rawReviews, fallbackReviews) {
  if (Array.isArray(rawReviews) && rawReviews.length > 0) {
    return rawReviews.slice(0, 3).map((review) => ({
      authorName: review.authorAttribution?.displayName || null,
      publishTime: review.publishTime ? String(review.publishTime).slice(0, 10) : null,
      rating: review.rating ?? null,
      text: (review.text?.text || "").slice(0, 120)
    }));
  }

  return Array.isArray(fallbackReviews) ? fallbackReviews : [];
}

function inferCategory(types, primaryType, fallbackCategory) {
  const joined = new Set([...(types || []), primaryType].filter(Boolean));
  if (joined.has("tourist_attraction") || joined.has("museum") || joined.has("art_gallery") || joined.has("park")) {
    return PLACE_CATEGORY.LANDMARK;
  }
  if (
    joined.has("restaurant") ||
    joined.has("cafe") ||
    joined.has("bar") ||
    joined.has("bakery") ||
    joined.has("meal_takeaway")
  ) {
    return PLACE_CATEGORY.FOODIE;
  }
  if (joined.has("shopping_mall") || joined.has("store") || joined.has("department_store")) {
    return PLACE_CATEGORY.SHOPPING;
  }
  return fallbackCategory || null;
}

module.exports = {
  hasGooglePlacesApiKey,
  extractPlaceIdsFromGoogleUrl,
  resolveGoogleMapsLink,
  searchPlacesByText,
  fetchPlaceDetailsById,
  normalizePlacePayload
};
