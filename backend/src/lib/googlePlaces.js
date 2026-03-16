const { PLACE_CATEGORY, PLACE_CATEGORY_VALUES } = require("./route-taxonomy");

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_BASE_URL = "https://places.googleapis.com/v1/places";
const STAY_TYPE_PATTERN =
  /(^|_)(lodging|hotel|hostel|guest_house|motel|resort_hotel|japanese_inn|budget_japanese_inn|extended_stay_hotel|private_guest_room|bed_and_breakfast|farmstay|cottage|campground|camping_cabin|rv_park|mobile_home_park|inn)(_|$)/i;
const IZAKAYA_TYPE_PATTERN =
  /(^|_)(japanese_izakaya_restaurant|izakaya)(_|$)/i;
const NIGHT_ACTIVITY_TYPE_PATTERN =
  /(^|_)(night_club|club|karaoke|live_music_venue|observation_deck|observation_tower|lookout|ferris_wheel)(_|$)/i;
const NIGHT_DRINK_TYPE_PATTERN =
  /(^|_)(bar|pub|wine_bar|cocktail_bar|beer_hall|beer_garden|sports_bar)(_|$)/i;
const ACTIVITY_TYPE_PATTERN =
  /(^|_)(amusement_center|amusement_park|bowling_alley|video_arcade|sports_activity_location|sports_complex|go_kart_track|public_bath|sauna)(_|$)/i;
const NATURE_TYPE_PATTERN =
  /(^|_)(natural_feature|national_park|garden|botanical_garden|beach|hiking_area|campground|camping_cabin|rv_park|mountain_peak|hot_spring|waterfall)(_|$)/i;
const LANDMARK_TYPE_PATTERN =
  /(^|_)(tourist_attraction|museum|art_gallery|park|historical_place|monument|castle|temple|church|mosque|synagogue|monastery|plaza|national_park|zoo)(_|$)/i;
const BRUNCH_TYPE_PATTERN =
  /(^|_)(breakfast_restaurant|brunch_restaurant|brunch)(_|$)/i;
const CAFE_TYPE_PATTERN =
  /(^|_)(cafe|coffee_shop|tea_house)(_|$)/i;
const SNACK_TYPE_PATTERN =
  /(^|_)(bakery|dessert|dessert_shop|dessert_restaurant|pastry|pastry_shop|patisserie|cake_shop|ice_cream_shop|ice_cream|juice_shop|donut_shop|chocolate_shop|confectionery|creperie|meal_takeaway)(_|$)/i;
const MEAL_TYPE_PATTERN =
  /(^|_)(restaurant|ramen_restaurant|sushi_restaurant|yakiniku_restaurant|yakitori_restaurant|izakaya|steak_house|seafood_restaurant|korean_restaurant|japanese_restaurant|italian_restaurant|french_restaurant|pizza_restaurant|burger_restaurant|udon_restaurant|soba_restaurant|tempura_restaurant|shabu_shabu_restaurant|tonkatsu_restaurant|curry_restaurant|food_court|meal_delivery)(_|$)/i;
const STRONG_MEAL_TYPE_PATTERN =
  /(^|_)(ramen_restaurant|sushi_restaurant|yakiniku_restaurant|steak_house|seafood_restaurant|korean_restaurant|italian_restaurant|french_restaurant|pizza_restaurant|burger_restaurant|udon_restaurant|soba_restaurant|tempura_restaurant|shabu_shabu_restaurant|tonkatsu_restaurant|curry_restaurant|western_restaurant|chicken_restaurant|hot_pot_restaurant)(_|$)/i;
const WEAK_FOODIE_TYPE_PATTERN = /(^|_)(food_store)(_|$)/i;
const SHOPPING_TYPE_PATTERN =
  /(^|_)(shopping_mall|department_store|clothing_store|electronics_store|furniture_store|gift_shop|book_store|jewelry_store|shoe_store|discount_store|drugstore|convenience_store|market|outlet_mall|home_goods_store|sporting_goods_store|toy_store)(_|$)/i;
const WEAK_STORE_TYPE_PATTERN = /(^|_)store($|_)/i;
const BRUNCH_NAME_PATTERN =
  /breakfast|brunch|모닝|브런치|아침/i;
const CAFE_NAME_PATTERN =
  /cafe|coffee|tea|roastery|카페|커피|로스터리|찻집/i;
const DESSERT_NAME_PATTERN =
  /cheesecake|pudding|dessert|sweet|sweets|cake|tart|pie|gelato|ice\s*cream|donut|macaron|chocolate|cookie|치즈케이크|푸딩|디저트|케이크|타르트|젤라또|아이스크림|도넛|마카롱|초콜릿|プリン|チーズケーキ|デザート|スイーツ|ケーキ|タルト|ジェラート|アイス|ドーナツ|マカロン|ショコラ|洋菓子/i;
const STRONG_MEAL_NAME_PATTERN =
  /ramen|sushi|yakiniku|gyukatsu|tonkatsu|katsu|udon|soba|tempura|okonomiyaki|shabu|sukiyaki|steak|burger|pizza|pasta|seafood|오코노미야키|규카츠|돈카츠|카츠|우동|소바|샤브|스키야키|스테이크|초밥|스시|라멘|해산물|쿠시카츠|くしかつ|串カツ|牛かつ|とんかつ|寿司|すし|ラーメン|うどん|そば|天ぷら|しゃぶ|すき焼き/i;
const NIGHT_ACTIVITY_NAME_PATTERN =
  /night\s*view|observation|observatory|lookout|rooftop|sky\s*lounge|skyline|tower|야경|전망대|루프탑|스카이라운지|클럽|노래방|가라오케|라이브/i;
const NIGHT_DRINK_NAME_PATTERN =
  /(^|[\s/&()\-])(?:bar|pub|club|karaoke|cocktail|lounge|speakeasy)(?=$|[\s/&()\-])|와인바|칵테일바|라운지|술집|펍/i;
const PLACE_CATEGORY_SET = new Set(PLACE_CATEGORY_VALUES);
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;
const DAYTIME_SERVICE_START_MINUTES = 6 * 60;
const DAYTIME_SERVICE_END_MINUTES = 15 * 60;
const EVENING_OPEN_THRESHOLD_MINUTES = 16 * 60 + 30;
const LATE_CLOSE_THRESHOLD_MINUTES = 22 * 60;
const WEAK_STORE_FALLBACK_CATEGORY_SET = new Set([
  PLACE_CATEGORY.STAY,
  PLACE_CATEGORY.MEAL,
  PLACE_CATEGORY.BRUNCH,
  PLACE_CATEGORY.CAFE,
  PLACE_CATEGORY.SNACK,
  PLACE_CATEGORY.ACTIVITY,
  PLACE_CATEGORY.LANDMARK,
  PLACE_CATEGORY.NATURE,
  PLACE_CATEGORY.SHOP
]);

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
  const placeName = googlePlace.displayName?.text || fallback.name || null;

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
    category: inferCategory(
      types,
      primaryType,
      fallback.category,
      placeName,
      googlePlace.regularOpeningHours || fallback.openingHours || null
    ),
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

function normalizeSignalText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}

function normalizePlaceCategory(value) {
  const normalized = normalizeSignalText(value).toUpperCase();
  if (!normalized) return null;
  return PLACE_CATEGORY_SET.has(normalized) ? normalized : null;
}

function hasPatternMatch(values, pattern) {
  return values.some((value) => pattern.test(String(value || "")));
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

function resolveFoodPreferredCategory({
  hasBrunchType,
  hasBrunchName,
  hasSnackType,
  hasDessertName,
  hasStrongMealType,
  hasStrongMealName,
  hasMealType,
  hasCafeType,
  hasCafeName
}) {
  if (hasBrunchType || hasBrunchName) {
    return PLACE_CATEGORY.BRUNCH;
  }

  // Tea salons and dessert cafes should stay in CAFE when Google provides
  // both cafe and pastry/dessert signals.
  if ((hasCafeType || hasCafeName) && (hasSnackType || hasDessertName) && !hasStrongMealType) {
    return PLACE_CATEGORY.CAFE;
  }

  if (hasSnackType || hasDessertName) {
    return PLACE_CATEGORY.SNACK;
  }

  if ((hasStrongMealType || hasStrongMealName) && hasMealType) {
    return PLACE_CATEGORY.MEAL;
  }

  if (hasMealType || hasStrongMealName) {
    return PLACE_CATEGORY.MEAL;
  }

  if (hasCafeType || hasCafeName) {
    return PLACE_CATEGORY.CAFE;
  }

  return null;
}

function inferCategory(types, primaryType, fallbackCategory, placeName = null, openingHours = null) {
  const joined = [...new Set([...(types || []), primaryType].filter(Boolean).map((value) => normalizeSignalText(value)))];
  const normalizedName = normalizeSignalText(placeName);
  const normalizedFallbackCategory = normalizePlaceCategory(fallbackCategory);
  const hasIzakayaType = hasPatternMatch(joined, IZAKAYA_TYPE_PATTERN);
  const hasNightActivityType = hasPatternMatch(joined, NIGHT_ACTIVITY_TYPE_PATTERN);
  const hasNightDrinkType = hasPatternMatch(joined, NIGHT_DRINK_TYPE_PATTERN);
  const hasActivityType = hasPatternMatch(joined, ACTIVITY_TYPE_PATTERN);
  const hasNatureType = hasPatternMatch(joined, NATURE_TYPE_PATTERN);
  const hasLandmarkType = hasPatternMatch(joined, LANDMARK_TYPE_PATTERN);
  const hasShoppingType = hasPatternMatch(joined, SHOPPING_TYPE_PATTERN);
  const hasBrunchType = hasPatternMatch(joined, BRUNCH_TYPE_PATTERN);
  const hasCafeType = hasPatternMatch(joined, CAFE_TYPE_PATTERN);
  const hasSnackType = hasPatternMatch(joined, SNACK_TYPE_PATTERN);
  const hasMealType = hasPatternMatch(joined, MEAL_TYPE_PATTERN);
  const hasStrongMealType = hasPatternMatch(joined, STRONG_MEAL_TYPE_PATTERN);
  const hasWeakFoodieType = hasPatternMatch(joined, WEAK_FOODIE_TYPE_PATTERN);
  const hasWeakStoreType = hasPatternMatch(joined, WEAK_STORE_TYPE_PATTERN);
  const hasNightActivityName = NIGHT_ACTIVITY_NAME_PATTERN.test(normalizedName);
  const hasNightDrinkName = NIGHT_DRINK_NAME_PATTERN.test(normalizedName);
  const hasStrongMealName = STRONG_MEAL_NAME_PATTERN.test(normalizedName);
  const hasBrunchName = BRUNCH_NAME_PATTERN.test(normalizedName);
  const hasCafeName = CAFE_NAME_PATTERN.test(normalizedName);
  const hasDessertName = DESSERT_NAME_PATTERN.test(normalizedName);
  const hasFoodSignal =
    hasBrunchType ||
    hasBrunchName ||
    hasCafeType ||
    hasCafeName ||
    hasSnackType ||
    hasDessertName ||
    hasMealType ||
    hasWeakFoodieType ||
    hasStrongMealName;
  const foodPreferredCategory = resolveFoodPreferredCategory({
    hasBrunchType,
    hasBrunchName,
    hasSnackType,
    hasDessertName,
    hasStrongMealType,
    hasStrongMealName,
    hasMealType,
    hasCafeType,
    hasCafeName
  });
  const openingSignals = getOpeningHoursSignals(openingHours);
  const hasDaytimeService = openingSignals.hasDaytimeService;
  const isEveningOnlyLateService = openingSignals.isEveningOnlyLateService;
  const hasDrinkOrIzakayaSignal = hasIzakayaType || hasNightDrinkType || hasNightDrinkName;

  if (hasPatternMatch(joined, STAY_TYPE_PATTERN)) {
    return PLACE_CATEGORY.STAY;
  }

  if (hasNightActivityType) {
    return PLACE_CATEGORY.NIGHT;
  }

  if (hasNatureType) {
    return PLACE_CATEGORY.NATURE;
  }

  if (hasLandmarkType) {
    return PLACE_CATEGORY.LANDMARK;
  }

  if (hasShoppingType) {
    return PLACE_CATEGORY.SHOP;
  }

  if (hasActivityType) {
    return PLACE_CATEGORY.ACTIVITY;
  }

  if (foodPreferredCategory === PLACE_CATEGORY.BRUNCH) {
    return PLACE_CATEGORY.BRUNCH;
  }

  if (foodPreferredCategory === PLACE_CATEGORY.SNACK) {
    return PLACE_CATEGORY.SNACK;
  }

  if (
    foodPreferredCategory === PLACE_CATEGORY.MEAL &&
    (hasStrongMealType || hasStrongMealName) &&
    !hasDrinkOrIzakayaSignal
  ) {
    return PLACE_CATEGORY.MEAL;
  }

  if (hasDrinkOrIzakayaSignal) {
    if (foodPreferredCategory && hasDaytimeService) {
      return foodPreferredCategory;
    }

    if (foodPreferredCategory === PLACE_CATEGORY.MEAL && (hasStrongMealType || hasStrongMealName)) {
      return hasIzakayaType && !hasDaytimeService ? PLACE_CATEGORY.NIGHT : PLACE_CATEGORY.MEAL;
    }

    if (isEveningOnlyLateService) {
      return PLACE_CATEGORY.NIGHT;
    }

    if (hasIzakayaType && foodPreferredCategory === PLACE_CATEGORY.MEAL) {
      return PLACE_CATEGORY.NIGHT;
    }

    if (!foodPreferredCategory) {
      return PLACE_CATEGORY.NIGHT;
    }

    return foodPreferredCategory;
  }

  if (foodPreferredCategory === PLACE_CATEGORY.MEAL) {
    return PLACE_CATEGORY.MEAL;
  }

  if (foodPreferredCategory === PLACE_CATEGORY.CAFE) {
    return PLACE_CATEGORY.CAFE;
  }

  if ((hasNightDrinkType || hasNightActivityName || hasNightDrinkName) && !hasFoodSignal) {
    return PLACE_CATEGORY.NIGHT;
  }

  if ((hasWeakStoreType || hasWeakFoodieType) && DESSERT_NAME_PATTERN.test(normalizedName)) {
    return PLACE_CATEGORY.SNACK;
  }

  if (hasWeakStoreType || hasWeakFoodieType) {
    return normalizedFallbackCategory && WEAK_STORE_FALLBACK_CATEGORY_SET.has(normalizedFallbackCategory)
      ? normalizedFallbackCategory
      : null;
  }

  return normalizedFallbackCategory || null;
}

module.exports = {
  hasGooglePlacesApiKey,
  extractPlaceIdsFromGoogleUrl,
  resolveGoogleMapsLink,
  searchPlacesByText,
  fetchPlaceDetailsById,
  normalizePlacePayload,
  inferCategory,
  getOpeningHoursSignals
};
