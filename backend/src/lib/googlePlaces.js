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

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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

  const q = url.searchParams.get("q");
  if (q && !q.toLowerCase().includes("place_id")) {
    return safeDecode(q).replace(/\+/g, " ").trim();
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
  const placeIds = extractPlaceIdsFromGoogleUrl(rawUrl);
  if (placeIds.length > 0) {
    return {
      kind: placeIds.length > 1 ? "LIST" : "PLACE",
      placeIds,
      note: "Resolved from URL tokens",
      query: null
    };
  }

  const query = extractSearchTextFromGoogleUrl(rawUrl);
  if (query && hasGooglePlacesApiKey()) {
    const places = await searchPlacesByText(query, 1);
    const resolvedPlaceId = places[0]?.id;
    if (resolvedPlaceId) {
      return {
        kind: "PLACE",
        placeIds: [resolvedPlaceId],
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
    price_level: googlePlace.priceLevel ?? fallback.priceLevel ?? null,
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
    return "LANDMARK";
  }
  if (
    joined.has("restaurant") ||
    joined.has("cafe") ||
    joined.has("bar") ||
    joined.has("bakery") ||
    joined.has("meal_takeaway")
  ) {
    return "FOODIE";
  }
  if (joined.has("shopping_mall") || joined.has("store") || joined.has("department_store")) {
    return "SHOPPING";
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
