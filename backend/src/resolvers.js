const { GraphQLError } = require("graphql");
const { createHash } = require("node:crypto");
const GraphQLJSON = require("graphql-type-json");
const { createSupabaseAdminClient, extractBearerToken } = require("./lib/supabase");
const {
  buildSchedulePlan,
  inferPlanningMode,
  recomputeStopTransports,
  resolveDayBudgetMinutes,
  selectCandidatesForAiPlanning
} = require("./lib/scheduleEngine");
const { sanitizeScheduledDayStops } = require("./lib/scheduleStopSanitizer");
const { buildStayRecommendation } = require("./lib/stayRecommendation");
const { scrapeList } = require("./lib/aiCrawler");
const { buildAiSchedulePlan } = require("./lib/geminiOptimizer");
const {
  hasGooglePlacesApiKey,
  resolveGoogleMapsLink,
  searchPlacesByText,
  fetchPlaceDetailsById,
  normalizePlacePayload,
  isImportBlockedBusinessStatus,
  isUnschedulableBusinessStatus,
  normalizeBusinessStatus
} = require("./lib/googlePlaces");
const { derivePlaceCategories } = require("./lib/place-semantics");
const { preprocessCandidatesForSchedule } = require("./lib/placeListPreprocessor");

const TABLES = {
  places: "places",
  placeLists: "place_lists",
  placeListItems: "place_list_items",
  importUsageEvents: "import_usage_events",
  aiUsageEvents: "ai_usage_events",
  schedules: "schedules",
  scheduleDays: "schedule_days",
  scheduleStops: "schedule_stops"
};
const MAX_SCHEDULE_DAY_COUNT = 7;
const MAX_PLACE_LIST_NAME_LENGTH = 12;
const MAX_PLACE_LIST_CITY_LENGTH = 12;
const MAX_PLACE_LIST_ITEMS = 50;
const MONTHLY_IMPORT_REQUEST_LIMIT = 100;
const MONTHLY_IMPORT_PLACE_LIMIT = 1000;
const DAILY_AI_GENERATION_LIMIT = 5;
const MONTHLY_AI_GENERATION_LIMIT = 500;
const PLACE_DETAILS_FRESHNESS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_AI_CANDIDATES = 70;
const DEFAULT_OUTPUT_LANGUAGE = "ko";
const SUPPORTED_APP_LANGUAGES = new Set(["ko", "en"]);
const GENERATION_VERSION = "mvp_v4_ai_route_v1_5";
const DATE_STEP_MUST_VISIT_PER_DAY_LIMIT = 7;
const FINAL_MUST_VISIT_MULTIPLIER_BY_PACE = {
  RELAXED: 5,
  MODERATE: 6,
  INTENSE: 7
};
const CITY_ALIAS_GROUPS = [
  ["bangkok", "방콕", "krung thep", "krungthep", "กรุงเทพ", "กรุงเทพมหานคร", "bkk"],
  ["osaka", "오사카", "大阪"],
  ["tokyo", "도쿄", "東京"],
  ["kyoto", "교토", "京都"],
  ["fukuoka", "후쿠오카", "福岡"],
  ["sapporo", "삿포로", "札幌"],
  ["busan", "부산", "釜山", "pusan"],
  ["seoul", "서울", "ソウル"],
  ["jeju", "제주", "濟州", "济州"],
  ["taipei", "타이베이", "臺北", "台北"],
  ["paris", "파리", "巴黎"],
  ["london", "런던", "倫敦"],
  ["new york", "뉴욕", "newyork"]
];
const GOOGLE_PLACE_MEDIA_PATTERN = /\/v1\/(places\/[^/]+\/photos\/[^/?#]+)\/media/i;
const LODGING_TYPE_PATTERN = /hotel|lodging|hostel|motel|guest|inn|resort|ryokan|accommodation/i;
const IMPORT_USAGE_SOURCES = {
  googleMapsList: "GOOGLE_MAPS_LIST",
  googleMapsLink: "GOOGLE_MAPS_LINK"
};
const AI_USAGE_SOURCES = {
  createSchedule: "CREATE_SCHEDULE",
  regenerateSchedule: "REGENERATE_SCHEDULE"
};

function fail(message, code = "INTERNAL_SERVER_ERROR", details = null) {
  throw new GraphQLError(message, { extensions: { code, details } });
}

function assertSupabase(error, message) {
  if (error) {
    fail(message, "INTERNAL_SERVER_ERROR", error.message);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uniqueValues(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function normalizeThemes(value) {
  if (!Array.isArray(value)) return [];
  const deduped = new Set();
  for (const theme of value) {
    if (typeof theme !== "string") continue;
    const normalized = theme.trim().toUpperCase();
    if (!normalized) continue;
    deduped.add(normalized);
  }
  return [...deduped];
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/[\s\W_]+/g, "");
}

function normalizeImportPlaceName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getKstMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  return `${year}-${month}`;
}

function getKstDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

function failMonthlyImportRequestLimitExceeded() {
  fail("Monthly import request quota exceeded", "IMPORT_LIST_QUOTA_EXCEEDED", {
    kind: "MONTHLY_IMPORT_REQUEST_QUOTA_EXCEEDED",
    limit: MONTHLY_IMPORT_REQUEST_LIMIT
  });
}

function failMonthlyImportPlaceLimitExceeded() {
  fail("Monthly import place quota exceeded", "IMPORT_PLACE_QUOTA_EXCEEDED", {
    kind: "MONTHLY_IMPORT_PLACE_QUOTA_EXCEEDED",
    limit: MONTHLY_IMPORT_PLACE_LIMIT
  });
}

function failDailyAiGenerationLimitExceeded() {
  fail("Daily AI generation quota exceeded", "AI_DAILY_QUOTA_EXCEEDED", {
    kind: "DAILY_AI_GENERATION_QUOTA_EXCEEDED",
    limit: DAILY_AI_GENERATION_LIMIT
  });
}

function failMonthlyAiGenerationLimitExceeded() {
  fail("Monthly AI generation quota exceeded", "AI_SYSTEM_MONTHLY_QUOTA_EXCEEDED", {
    kind: "MONTHLY_SYSTEM_AI_GENERATION_QUOTA_EXCEEDED",
    limit: MONTHLY_AI_GENERATION_LIMIT
  });
}

function isPlaceDetailsFresh(placeRow, now = Date.now()) {
  const updatedAtMs = Date.parse(placeRow?.updated_at || "");
  return Number.isFinite(updatedAtMs) && now - updatedAtMs <= PLACE_DETAILS_FRESHNESS_WINDOW_MS;
}

function isBangkokCity(cityName) {
  const city = normalizeText(cityName);
  return (
    city.includes("bangkok") ||
    city.includes("krung thep") ||
    city.includes("방콕") ||
    city.includes("กรุงเทพ")
  );
}

function getCityAliasTokens(cityName) {
  const city = normalizeText(cityName);
  const compactCity = compactText(cityName);

  for (const group of CITY_ALIAS_GROUPS) {
    const aliases = group.flatMap((alias) => [normalizeText(alias), compactText(alias)]).filter(Boolean);
    if (aliases.includes(city) || aliases.includes(compactCity)) {
      return aliases;
    }
  }

  return [];
}

function buildCityTokens(cityName) {
  const city = normalizeText(cityName);
  if (!city) return [];

  const tokens = new Set([city, compactText(city), ...getCityAliasTokens(cityName)]);
  if (isBangkokCity(city)) {
    [
      "bangkok",
      "krung thep",
      "krungthep",
      "bkk",
      "방콕",
      "กรุงเทพ",
      "กรุงเทพมหานคร",
      "thailand",
      "태국"
    ].forEach((token) => {
      tokens.add(normalizeText(token));
      tokens.add(compactText(token));
    });
  }

  return [...tokens].filter(Boolean);
}

function includesCityToken(text, cityTokens) {
  if (!text || cityTokens.length === 0) return false;
  const normalized = normalizeText(text);
  const compact = compactText(text);
  return cityTokens.some((token) => {
    if (!token) return false;
    return normalized.includes(token) || compact.includes(token);
  });
}

function isLodgingPlace(place) {
  const categories = Array.isArray(place?.categories) ? place.categories : [];
  if (categories.includes("STAY")) {
    return true;
  }

  const types = Array.isArray(place?.types_raw)
    ? place.types_raw
    : Array.isArray(place?.typesRaw)
      ? place.typesRaw
      : [];
  return types.some((type) => LODGING_TYPE_PATTERN.test(String(type || "")));
}

function extractPhotoResourceName(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^places\/[^/]+\/photos\/[^/?#]+$/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed.match(GOOGLE_PLACE_MEDIA_PATTERN)?.[1] || null;
}

function normalizePhotoAttribution(value) {
  if (!value || typeof value !== "object") return { displayName: null, uri: null };
  return {
    displayName: typeof value.displayName === "string" && value.displayName.trim() ? value.displayName.trim() : null,
    uri: typeof value.uri === "string" && value.uri.trim() ? value.uri.trim() : null
  };
}

function normalizeStoredPhotos(rawPhotos) {
  if (!Array.isArray(rawPhotos)) return [];

  return rawPhotos
    .map((photo) => {
      if (typeof photo === "string") {
        const name = extractPhotoResourceName(photo);
        if (!name) return null;
        return { name, displayName: null, uri: null };
      }

      if (!photo || typeof photo !== "object") {
        return null;
      }

      const name = extractPhotoResourceName(photo.name);
      if (!name) return null;

      const attribution =
        photo.attribution && typeof photo.attribution === "object"
          ? normalizePhotoAttribution(photo.attribution)
          : Array.isArray(photo.authorAttributions) && photo.authorAttributions.length > 0
            ? normalizePhotoAttribution(photo.authorAttributions[0])
            : normalizePhotoAttribution(photo);

      return {
        name,
        displayName: attribution.displayName,
        uri: attribution.uri
      };
    })
    .filter(Boolean);
}

function normalizeStoredPlaceRow(row) {
  if (!row) return row;

  const typesRaw = Array.isArray(row.types_raw)
    ? row.types_raw
    : Array.isArray(row.typesRaw)
      ? row.typesRaw
      : [];

  const primaryType = row.primary_type || row.primaryType || null;
  const categories = Array.isArray(row.categories)
    ? row.categories
    : derivePlaceCategories({
        types: typesRaw,
        primaryType
      });

  return {
    ...row,
    types_raw: typesRaw,
    primary_type: primaryType,
    business_status: normalizeBusinessStatus(row.business_status || row.businessStatus),
    address_components: Array.isArray(row.address_components)
      ? row.address_components
      : Array.isArray(row.addressComponents)
        ? row.addressComponents
        : [],
    photos: normalizeStoredPhotos(row.photos),
    categories
  };
}

function filterSchedulableCandidates(candidates) {
  return (candidates || []).filter((candidate) => {
    const place = candidate?.place || null;
    if (!place) return false;
    if (isLodgingPlace(place)) return false;
    if (isUnschedulableBusinessStatus(place.business_status || place.businessStatus)) return false;
    return true;
  });
}

function parseDateStrict(value, fieldName) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`${fieldName} must be YYYY-MM-DD`, "BAD_USER_INPUT");
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    fail(`${fieldName} is invalid`, "BAD_USER_INPUT");
  }

  return date;
}

function computeDayCount(startDate, endDate) {
  const start = parseDateStrict(startDate, "startDate");
  const end = parseDateStrict(endDate, "endDate");
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) {
    fail("endDate must be greater than or equal to startDate", "BAD_USER_INPUT");
  }

  const dayCount = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
  if (dayCount < 1 || dayCount > MAX_SCHEDULE_DAY_COUNT) {
    fail(`dayCount must be between 1 and ${MAX_SCHEDULE_DAY_COUNT}`, "BAD_USER_INPUT");
  }
  return dayCount;
}

function toDateWithOffset(startDate, offsetDays) {
  const date = parseDateStrict(startDate, "startDate");
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function trimRequired(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    fail(`${fieldName} is required`, "BAD_USER_INPUT");
  }
  return value.trim();
}

function trimRequiredWithMaxLength(value, fieldName, maxLength) {
  const trimmed = trimRequired(value, fieldName);
  if (trimmed.length > maxLength) {
    fail(`${fieldName} must be at most ${maxLength} characters`, "BAD_USER_INPUT");
  }
  return trimmed;
}

function normalizeLanguage(value, fallback = DEFAULT_OUTPUT_LANGUAGE) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (SUPPORTED_APP_LANGUAGES.has(normalized)) {
    return normalized;
  }
  fail(`language must be one of ${[...SUPPORTED_APP_LANGUAGES].join(", ")}`, "BAD_USER_INPUT");
}

function buildTripDays(startDate, dayCount) {
  return Array.from({ length: dayCount }, (_, index) => {
    const date = toDateWithOffset(startDate, index);
    const weekdayEn = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "UTC"
    }).format(new Date(`${date}T00:00:00Z`));

    const weekdayKo = new Intl.DateTimeFormat("ko-KR", {
      weekday: "long",
      timeZone: "UTC"
    }).format(new Date(`${date}T00:00:00Z`));

    return {
      day: index + 1,
      date,
      weekdayEn,
      weekdayKo
    };
  });
}

function normalizePace(value, fallback = "MODERATE") {
  const normalized = String(value || fallback)
    .trim()
    .toUpperCase();
  if (normalized === "RELAXED" || normalized === "MODERATE" || normalized === "INTENSE") {
    return normalized;
  }
  return fallback;
}

function resolveFinalMustVisitLimit(dayCount, pace) {
  const normalizedPace = normalizePace(pace, "MODERATE");
  return Math.max(1, Number(dayCount) || 1) * (FINAL_MUST_VISIT_MULTIPLIER_BY_PACE[normalizedPace] || 6);
}

function countSchedulableMustVisitCandidates(candidates) {
  return (candidates || []).reduce((count, candidate) => count + (candidate?.isMustVisit ? 1 : 0), 0);
}

function buildMustVisitLimitDetails(dayCount, mustVisitCount, limit) {
  return {
    kind: "MUST_VISIT_LIMIT_EXCEEDED",
    dayCount,
    mustVisitCount,
    limit
  };
}

function assertMustVisitLimit({ candidates, dayCount, limit }) {
  const mustVisitCount = countSchedulableMustVisitCandidates(candidates);
  if (mustVisitCount > limit) {
    fail(
      `${dayCount}일 여행에서는 Must Visit를 최대 ${limit}개까지 반영할 수 있어요`,
      "BAD_USER_INPUT",
      buildMustVisitLimitDetails(dayCount, mustVisitCount, limit)
    );
  }

  return mustVisitCount;
}

function mapUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email || null };
}

function mapAuthPayload(authData) {
  const session = authData?.session || null;
  const user = authData?.user || session?.user || null;
  return {
    accessToken: session?.access_token || null,
    refreshToken: session?.refresh_token || null,
    expiresAt: session?.expires_at || null,
    tokenType: session?.token_type || null,
    user: mapUser(user)
  };
}

function mapPlace(row) {
  if (!row) return null;
  const ratingNumber = row.rating == null ? null : Number(row.rating);
  const normalizedRow = normalizeStoredPlaceRow(row);
  return {
    id: normalizedRow.id,
    googlePlaceId: normalizedRow.google_place_id,
    name: normalizedRow.name,
    formattedAddress: normalizedRow.formatted_address,
    lat: normalizedRow.lat,
    lng: normalizedRow.lng,
    rating: Number.isNaN(ratingNumber) ? null : ratingNumber,
    userRatingCount: normalizedRow.user_rating_count,
    priceLevel: normalizedRow.price_level,
    typesRaw: Array.isArray(normalizedRow.types_raw) ? normalizedRow.types_raw : [],
    primaryType: normalizedRow.primary_type || null,
    businessStatus: normalizedRow.business_status || null,
    categories: Array.isArray(normalizedRow.categories) ? normalizedRow.categories : [],
    openingHours: normalizedRow.opening_hours,
    photos: Array.isArray(normalizedRow.photos) ? normalizedRow.photos : [],
    coverPhoto: Array.isArray(normalizedRow.photos) && normalizedRow.photos.length > 0 ? normalizedRow.photos[0] : null,
    website: normalizedRow.website,
    googleMapsUrl: normalizedRow.google_maps_url,
    createdAt: normalizedRow.created_at,
    updatedAt: normalizedRow.updated_at
  };
}

function mapPlaceList(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    city: row.city,
    language: normalizeLanguage(row.language, DEFAULT_OUTPUT_LANGUAGE),
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPlaceListItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    listId: row.list_id,
    placeId: row.place_id,
    note: row.note,
    isMustVisit: Boolean(row.is_must_visit),
    createdAt: row.created_at
  };
}

function mapSchedule(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    dayCount: row.day_count,
    placeListId: row.place_list_id,
    stayPlaceId: row.stay_place_id,
    stayRecommendation:
      row.stay_recommendation && typeof row.stay_recommendation === "object" ? row.stay_recommendation : null,
    companions: row.companions,
    pace: row.pace,
    themes: normalizeThemes(row.themes),
    outputLanguage: normalizeLanguage(row.output_language, DEFAULT_OUTPUT_LANGUAGE),
    generationInput: asObject(row.generation_input),
    generationVersion: row.generation_version,
    isManualModified: row.is_manual_modified,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapScheduleDay(row) {
  if (!row) return null;
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    dayNumber: row.day_number,
    date: row.date
  };
}

function mapScheduleStop(row) {
  if (!row) return null;
  return {
    id: row.id,
    scheduleDayId: row.schedule_day_id,
    placeId: row.place_id,
    stopOrder: row.stop_order,
    time: row.time ? String(row.time).slice(0, 5) : null,
    label: row.label,
    isMustVisit: Boolean(row.is_must_visit),
    note: row.note,
    reason: row.reason,
    visitTip: row.visit_tip,
    transportToNext: row.transport_to_next,
    isUserModified: row.is_user_modified
  };
}

async function getOptionalUser(context) {
  if (Object.prototype.hasOwnProperty.call(context, "cachedUser")) {
    return context.cachedUser;
  }

  const token = extractBearerToken(context.authHeader);
  if (!token) {
    context.cachedUser = null;
    return null;
  }

  const { data, error } = await context.supabasePublic.auth.getUser(token);
  if (error) {
    fail("Invalid or expired auth token", "UNAUTHENTICATED", error.message);
  }

  context.cachedUser = data.user || null;
  return context.cachedUser;
}

async function requireUser(context) {
  const user = await getOptionalUser(context);
  if (!user) fail("Authentication required", "UNAUTHENTICATED");
  return user;
}

async function fetchPlaceById(supabase, id) {
  const { data, error } = await supabase.from(TABLES.places).select("*").eq("id", id).maybeSingle();
  assertSupabase(error, "Failed to fetch place");
  return normalizeStoredPlaceRow(data || null);
}

async function fetchPlaceByGooglePlaceId(supabase, googlePlaceId) {
  const { data, error } = await supabase
    .from(TABLES.places)
    .select("*")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();
  assertSupabase(error, "Failed to fetch place by google_place_id");
  return normalizeStoredPlaceRow(data || null);
}

async function fetchCachedPlaceByGooglePlaceId(supabase, cache, googlePlaceId) {
  const cacheKey = String(googlePlaceId || "").trim();
  if (!cacheKey) return null;
  if (!cache.has(cacheKey)) {
    cache.set(cacheKey, fetchPlaceByGooglePlaceId(supabase, cacheKey));
  }
  return cache.get(cacheKey);
}

async function fetchCachedSearchPlacesByText(cache, textQuery, maxResultCount = 5, options = {}) {
  const cacheKey = `${maxResultCount}:${normalizeText(textQuery)}`;
  if (!cache.has(cacheKey)) {
    if (typeof options.onMiss === "function") {
      await options.onMiss({ textQuery, maxResultCount });
    }
    cache.set(cacheKey, searchPlacesByText(textQuery, maxResultCount));
  }
  return cache.get(cacheKey);
}

async function fetchCachedPlaceDetails(cache, placeId, options = {}) {
  const cacheKey = String(placeId || "").trim();
  if (!cacheKey) return null;
  if (!cache.has(cacheKey)) {
    if (typeof options.onMiss === "function") {
      await options.onMiss({ placeId: cacheKey });
    }
    cache.set(cacheKey, fetchPlaceDetailsById(cacheKey));
  }
  return cache.get(cacheKey);
}

async function fetchMonthlyImportUsage(adminClient, usageMonth) {
  const { data, error } = await adminClient
    .from(TABLES.importUsageEvents)
    .select("import_request_count,import_place_count")
    .eq("usage_month", usageMonth);
  assertSupabase(error, "Failed to fetch monthly import usage");

  const rows = data || [];
  return rows.reduce(
    (acc, row) => ({
      requestCount: acc.requestCount + Number(row.import_request_count || 0),
      placeCount: acc.placeCount + Number(row.import_place_count || 0)
    }),
    { requestCount: 0, placeCount: 0 }
  );
}

async function insertImportUsageEvent(adminClient, payload) {
  const { error } = await adminClient.from(TABLES.importUsageEvents).insert(payload);
  assertSupabase(error, "Failed to record import usage");
}

async function fetchAiUsageSnapshot(adminClient, userId, usageDate, usageMonth) {
  const [dailyResult, monthlyResult] = await Promise.all([
    adminClient
      .from(TABLES.aiUsageEvents)
      .select("id", { head: true, count: "exact" })
      .eq("user_id", userId)
      .eq("usage_date", usageDate),
    adminClient
      .from(TABLES.aiUsageEvents)
      .select("id", { head: true, count: "exact" })
      .eq("usage_month", usageMonth)
  ]);

  assertSupabase(dailyResult.error, "Failed to fetch daily AI usage");
  assertSupabase(monthlyResult.error, "Failed to fetch monthly AI usage");

  return {
    dailyUserCount: dailyResult.count || 0,
    monthlySystemCount: monthlyResult.count || 0
  };
}

async function insertAiUsageEvent(adminClient, payload) {
  const { error } = await adminClient.from(TABLES.aiUsageEvents).insert(payload);
  assertSupabase(error, "Failed to record AI usage");
}

function createAiUsageTracker(userId, source) {
  const adminClient = createSupabaseAdminClient();
  const usageDate = getKstDateKey();
  const usageMonth = getKstMonthKey();
  let snapshotPromise = null;
  let recorded = false;

  async function getSnapshot() {
    if (!snapshotPromise) {
      snapshotPromise = fetchAiUsageSnapshot(adminClient, userId, usageDate, usageMonth);
    }
    return snapshotPromise;
  }

  return {
    async recordUsage() {
      if (recorded) return;

      const usage = await getSnapshot();
      if (usage.monthlySystemCount + 1 > MONTHLY_AI_GENERATION_LIMIT) {
        failMonthlyAiGenerationLimitExceeded();
      }
      if (usage.dailyUserCount + 1 > DAILY_AI_GENERATION_LIMIT) {
        failDailyAiGenerationLimitExceeded();
      }

      await insertAiUsageEvent(adminClient, {
        user_id: userId,
        usage_date: usageDate,
        usage_month: usageMonth,
        source
      });

      usage.dailyUserCount += 1;
      usage.monthlySystemCount += 1;
      recorded = true;
    }
  };
}

function createMonthlyImportUsageTracker(userId, source) {
  const adminClient = createSupabaseAdminClient();
  const usageMonth = getKstMonthKey();
  let snapshotPromise = null;
  let requestRecorded = false;

  async function getSnapshot() {
    if (!snapshotPromise) {
      snapshotPromise = fetchMonthlyImportUsage(adminClient, usageMonth);
    }
    return snapshotPromise;
  }

  async function recordImportRequestIfNeeded() {
    if (requestRecorded) return;
    const usage = await getSnapshot();
    if (usage.requestCount + 1 > MONTHLY_IMPORT_REQUEST_LIMIT) {
      failMonthlyImportRequestLimitExceeded();
    }

    await insertImportUsageEvent(adminClient, {
      user_id: userId,
      usage_month: usageMonth,
      source,
      import_request_count: 1,
      import_place_count: 0
    });
    usage.requestCount += 1;
    requestRecorded = true;
  }

  return {
    async ensurePlaceCapacity(placeUnits = 0) {
      const normalizedPlaceUnits = Number(placeUnits);
      if (!Number.isFinite(normalizedPlaceUnits) || normalizedPlaceUnits <= 0) return;

      const usage = await getSnapshot();
      if (usage.placeCount + normalizedPlaceUnits > MONTHLY_IMPORT_PLACE_LIMIT) {
        failMonthlyImportPlaceLimitExceeded();
      }
    },

    async recordSearchMiss() {
      await recordImportRequestIfNeeded();
    },

    async recordPlaceDetailsMiss(placeUnits = 1) {
      const normalizedPlaceUnits = Number(placeUnits);
      if (!Number.isFinite(normalizedPlaceUnits) || normalizedPlaceUnits <= 0) return;

      await recordImportRequestIfNeeded();

      const usage = await getSnapshot();
      if (usage.placeCount + normalizedPlaceUnits > MONTHLY_IMPORT_PLACE_LIMIT) {
        failMonthlyImportPlaceLimitExceeded();
      }

      await insertImportUsageEvent(adminClient, {
        user_id: userId,
        usage_month: usageMonth,
        source,
        import_request_count: 0,
        import_place_count: normalizedPlaceUnits
      });
      usage.placeCount += normalizedPlaceUnits;
    }
  };
}

async function fetchPlacesByIds(supabase, ids) {
  const deduped = [...new Set(ids || [])];
  if (deduped.length === 0) return [];

  const { data, error } = await supabase.from(TABLES.places).select("*").in("id", deduped);
  assertSupabase(error, "Failed to fetch places");

  const rows = data || [];
  if (rows.length !== deduped.length) {
    const found = new Set(rows.map((row) => row.id));
    const missing = deduped.filter((id) => !found.has(id));
    fail(`Some places were not found: ${missing.join(", ")}`, "BAD_USER_INPUT");
  }

  return rows.map((row) => normalizeStoredPlaceRow(row));
}

async function upsertSharedPlace(supabase, payload) {
  const { data, error } = await supabase
    .from(TABLES.places)
    .upsert(payload, { onConflict: "google_place_id" })
    .select("*")
    .single();

  assertSupabase(error, "Failed to upsert place");
  return normalizeStoredPlaceRow(data);
}

async function fetchOwnedPlaceList(supabase, userId, listId) {
  const { data, error } = await supabase
    .from(TABLES.placeLists)
    .select("*")
    .eq("user_id", userId)
    .eq("id", listId)
    .maybeSingle();
  assertSupabase(error, "Failed to fetch place list");
  return data || null;
}

async function fetchOwnedPlaceListsByIds(supabase, userId, listIds) {
  const deduped = uniqueValues(listIds);
  if (deduped.length === 0) return [];

  const { data, error } = await supabase
    .from(TABLES.placeLists)
    .select("*")
    .eq("user_id", userId)
    .in("id", deduped);
  assertSupabase(error, "Failed to fetch place lists");
  return data || [];
}

async function fetchPlaceListItemById(supabase, id) {
  const { data, error } = await supabase.from(TABLES.placeListItems).select("*").eq("id", id).maybeSingle();
  assertSupabase(error, "Failed to fetch place list item");
  return data || null;
}

async function fetchPlaceListItemByListAndPlaceId(supabase, listId, placeId) {
  const { data, error } = await supabase
    .from(TABLES.placeListItems)
    .select("*")
    .eq("list_id", listId)
    .eq("place_id", placeId)
    .maybeSingle();
  assertSupabase(error, "Failed to fetch place list item by list/place");
  return data || null;
}

async function fetchPlaceListItemCount(supabase, listId) {
  const { count, error } = await supabase
    .from(TABLES.placeListItems)
    .select("id", { count: "exact", head: true })
    .eq("list_id", listId);
  assertSupabase(error, "Failed to fetch place list item count");
  return Number(count || 0);
}

async function fetchNextPlaceListSortOrder(supabase, listId) {
  const { data, error } = await supabase
    .from(TABLES.placeListItems)
    .select("sort_order")
    .eq("list_id", listId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertSupabase(error, "Failed to fetch next place list sort order");
  return Number(data?.sort_order || 0) + 1;
}

async function ensureOwnedPlaceListItem(supabase, userId, itemId) {
  const item = await fetchPlaceListItemById(supabase, itemId);
  if (!item) return null;

  const ownerList = await fetchOwnedPlaceList(supabase, userId, item.list_id);
  if (!ownerList) return null;
  return item;
}

async function fetchOwnedSchedule(supabase, userId, scheduleId) {
  const { data, error } = await supabase
    .from(TABLES.schedules)
    .select("*")
    .eq("user_id", userId)
    .eq("id", scheduleId)
    .maybeSingle();
  assertSupabase(error, "Failed to fetch schedule");
  return data || null;
}

async function fetchOwnedScheduleStop(supabase, scheduleId, stopId) {
  const { data: dayRows, error: dayError } = await supabase
    .from(TABLES.scheduleDays)
    .select("id")
    .eq("schedule_id", scheduleId);
  assertSupabase(dayError, "Failed to fetch schedule days");

  const dayIds = (dayRows || []).map((row) => row.id);
  if (dayIds.length === 0) return null;

  const { data, error } = await supabase
    .from(TABLES.scheduleStops)
    .select("*")
    .eq("id", stopId)
    .in("schedule_day_id", dayIds)
    .maybeSingle();
  assertSupabase(error, "Failed to fetch schedule stop");
  return data || null;
}

async function fetchPlaceListCandidates(supabase, listId) {
  const { data: itemRows, error: itemError } = await supabase
    .from(TABLES.placeListItems)
    .select("*")
    .eq("list_id", listId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  assertSupabase(itemError, "Failed to fetch place list items");

  const items = itemRows || [];
  if (items.length === 0) {
    return { items: [], candidates: [] };
  }

  const placeIds = items.map((item) => item.place_id);
  const places = await fetchPlacesByIds(supabase, placeIds);
  const byId = new Map(places.map((place) => [place.id, place]));

  const candidates = items
    .map((item) => ({
      place: byId.get(item.place_id),
      note: item.note,
      isMustVisit: Boolean(item.is_must_visit)
    }))
    .filter((entry) => entry.place);

  return { items, candidates, placeById: byId };
}

async function buildPlaceListPreviewData(supabase, listIds, previewLimit = 4) {
  const dedupedListIds = uniqueValues(listIds);
  if (dedupedListIds.length === 0) {
    return {
      countsByListId: new Map(),
      previewPlacesByListId: new Map()
    };
  }

  const { data: itemRows, error: itemError } = await supabase
    .from(TABLES.placeListItems)
    .select("id, list_id, place_id, sort_order")
    .in("list_id", dedupedListIds)
    .order("list_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  assertSupabase(itemError, "Failed to fetch place list preview items");

  const countsByListId = new Map();
  const previewPlaceIdsByListId = new Map();

  for (const row of itemRows || []) {
    countsByListId.set(row.list_id, (countsByListId.get(row.list_id) || 0) + 1);

    if (!row.place_id) continue;
    const currentPreviewIds = previewPlaceIdsByListId.get(row.list_id) || [];
    if (currentPreviewIds.length >= previewLimit) continue;
    currentPreviewIds.push(row.place_id);
    previewPlaceIdsByListId.set(row.list_id, currentPreviewIds);
  }

  const previewPlaceIds = uniqueValues(
    [...previewPlaceIdsByListId.values()].flatMap((placeIds) => placeIds)
  );
  const placeRows = previewPlaceIds.length > 0 ? await fetchPlacesByIds(supabase, previewPlaceIds) : [];
  const previewPlaceById = new Map(placeRows.map((row) => [row.id, mapPlace(row)]));
  const previewPlacesByListId = new Map();

  for (const listId of dedupedListIds) {
    const previewPlaces = (previewPlaceIdsByListId.get(listId) || [])
      .map((placeId) => previewPlaceById.get(placeId))
      .filter(Boolean);
    previewPlacesByListId.set(listId, previewPlaces);
  }

  return {
    countsByListId,
    previewPlacesByListId
  };
}

async function preloadPlaceListDetail(supabase, placeListRow) {
  const mappedPlaceList = mapPlaceList(placeListRow);
  const { data: itemRows, error: itemError } = await supabase
    .from(TABLES.placeListItems)
    .select("*")
    .eq("list_id", placeListRow.id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  assertSupabase(itemError, "Failed to fetch place list items");

  const placeRows = await fetchPlacesByIds(
    supabase,
    uniqueValues((itemRows || []).map((row) => row.place_id))
  );
  const placeById = new Map(placeRows.map((row) => [row.id, mapPlace(row)]));
  const items = (itemRows || []).map((row) => ({
    ...mapPlaceListItem(row),
    place: placeById.get(row.place_id) || null
  }));

  return {
    ...mappedPlaceList,
    itemCount: items.length,
    items,
    previewPlaces: items.map((item) => item.place).filter(Boolean).slice(0, 4)
  };
}

async function preloadScheduleDetail(supabase, userId, scheduleRow) {
  const mappedSchedule = mapSchedule(scheduleRow);
  const [placeListRow, dayRowsResult] = await Promise.all([
    fetchOwnedPlaceList(supabase, userId, scheduleRow.place_list_id),
    supabase
      .from(TABLES.scheduleDays)
      .select("*")
      .eq("schedule_id", scheduleRow.id)
      .order("day_number", { ascending: true })
  ]);

  const { data: dayRows, error: dayError } = dayRowsResult;
  assertSupabase(dayError, "Failed to fetch schedule days");

  const dayIds = uniqueValues((dayRows || []).map((row) => row.id));
  const stopResult =
    dayIds.length > 0
      ? await supabase
          .from(TABLES.scheduleStops)
          .select("*")
          .in("schedule_day_id", dayIds)
          .order("schedule_day_id", { ascending: true })
          .order("stop_order", { ascending: true })
      : { data: [], error: null };
  assertSupabase(stopResult.error, "Failed to fetch schedule stops");

  const stopRows = stopResult.data || [];
  const placeIds = uniqueValues([
    ...stopRows.map((row) => row.place_id),
    scheduleRow.stay_place_id
  ]);
  const placeRows = placeIds.length > 0 ? await fetchPlacesByIds(supabase, placeIds) : [];
  const placeById = new Map(placeRows.map((row) => [row.id, mapPlace(row)]));
  const stopsByDayId = new Map();

  for (const stopRow of stopRows) {
    const mappedStop = {
      ...mapScheduleStop(stopRow),
      place: placeById.get(stopRow.place_id) || null
    };
    const currentStops = stopsByDayId.get(stopRow.schedule_day_id) || [];
    currentStops.push(mappedStop);
    stopsByDayId.set(stopRow.schedule_day_id, currentStops);
  }

  const days = (dayRows || []).map((row) => {
    const resolvedStops = mappedSchedule.isManualModified
      ? recomputeStopTransports(stopsByDayId.get(row.id) || [])
      : recomputeStopTransports(
          sanitizeScheduledDayStops({
            stops: stopsByDayId.get(row.id) || [],
            visitDate: row.date,
            outputLanguage: mappedSchedule.outputLanguage
          })
        ).map((stop) => {
          const { corrected, ...resolvedStop } = stop;
          return resolvedStop;
        });

    return {
      ...mapScheduleDay(row),
      stops: resolvedStops
    };
  });

  return {
    ...mappedSchedule,
    placeList: placeListRow ? await preloadPlaceListDetail(supabase, placeListRow) : null,
    stayPlace: scheduleRow.stay_place_id ? placeById.get(scheduleRow.stay_place_id) || null : null,
    days
  };
}

function normalizeScheduleEditNote(value) {
  return typeof value === "string" ? value.trim() || null : null;
}

function buildManualScheduleStopSnapshot(dayInput, placeById) {
  const draftStops = (Array.isArray(dayInput?.stops) ? dayInput.stops : []).map((stop) => {
    const place = placeById.get(stop.placeId);
    return {
      place,
      note: normalizeScheduleEditNote(stop.note),
      isMustVisit: Boolean(stop.isMustVisit)
    };
  });

  return recomputeStopTransports(draftStops).map((stop, index) => ({
    stopOrder: index + 1,
    placeId: stop.place.id,
    time: null,
    label: null,
    isMustVisit: Boolean(stop.isMustVisit),
    note: stop.note ?? null,
    reason: null,
    visitTip: null,
    transportToNext: stop.transportToNext || null,
    isUserModified: true
  }));
}

async function writeScheduleDaysAndStops({ supabase, scheduleId, planDays, startDate, isUserModified = false }) {
  const dayPayload = planDays.map((day) => ({
    schedule_id: scheduleId,
    day_number: day.dayNumber,
    date: toDateWithOffset(startDate, day.dayNumber - 1)
  }));

  const { data: dayRows, error: dayError } = await supabase.from(TABLES.scheduleDays).insert(dayPayload).select("*");
  assertSupabase(dayError, "Failed to create schedule days");

  const dayMap = new Map((dayRows || []).map((row) => [row.day_number, row.id]));
  const stopPayload = [];

  for (const day of planDays) {
    const dayId = dayMap.get(day.dayNumber);
    if (!dayId) fail("Schedule day mapping failed");

    day.stops.forEach((stop, index) => {
        stopPayload.push({
          schedule_day_id: dayId,
          stop_order: index + 1,
          place_id: stop.placeId,
          time: stop.time || null,
          label: stop.label || null,
          is_must_visit: Boolean(stop.isMustVisit),
          note: stop.note || null,
          reason: stop.reason || null,
          visit_tip: stop.visitTip || null,
        transport_to_next: stop.transportToNext || null,
        is_user_modified: isUserModified
      });
    });
  }

  if (stopPayload.length > 0) {
    const { error: stopError } = await supabase.from(TABLES.scheduleStops).insert(stopPayload);
    assertSupabase(stopError, "Failed to create schedule stops");
  }
}

function sanitizePlanDaysForPersistence({ planDays, placeById, outputLanguage, tripDays }) {
  const tripDayByNumber = new Map((tripDays || []).map((tripDay) => [Number(tripDay.day), tripDay]));

  return (planDays || []).map((day) => {
    const enrichedStops = (day.stops || []).map((stop) => ({
      ...stop,
      place: placeById.get(stop.placeId) || null
    }));
    const sanitizedStops = recomputeStopTransports(
      sanitizeScheduledDayStops({
        stops: enrichedStops,
        visitDate: tripDayByNumber.get(Number(day.dayNumber))?.date || null,
        outputLanguage
      })
    ).map((stop) => {
      const { corrected, place, ...persistedStop } = stop;
      if (corrected) {
        return {
          ...persistedStop,
          reason: null,
          visitTip: null
        };
      }
      return persistedStop;
    });

    return {
      ...day,
      stops: sanitizedStops
    };
  });
}

function buildGenerationInput(payload) {
  return {
    startDate: payload.startDate,
    endDate: payload.endDate,
    dayCount: payload.dayCount,
    city: payload.city || null,
    companions: payload.companions || null,
    pace: payload.pace || null,
    themes: normalizeThemes(payload.themes),
    placeListId: payload.placeListId,
    stayPlaceId: payload.stayPlaceId || null,
    planningMode: payload.planningMode || null,
    dayBudgetMinutes: Number(payload.dayBudgetMinutes) || resolveDayBudgetMinutes({ pace: payload.pace }),
    candidateTrim:
      payload.candidateTrim && typeof payload.candidateTrim === "object"
        ? payload.candidateTrim
        : null,
    aiFallback:
      payload.aiFallback && typeof payload.aiFallback === "object"
        ? payload.aiFallback
        : null,
    outputLanguage: normalizeLanguage(payload.outputLanguage, DEFAULT_OUTPUT_LANGUAGE),
    candidatePreprocess:
      payload.candidatePreprocess && typeof payload.candidatePreprocess === "object"
        ? payload.candidatePreprocess
        : null,
    tripDays: buildTripDays(payload.startDate, payload.dayCount)
  };
}

async function resolveSchedulePlanDays({
  candidates,
  dayCount,
  stayPlace,
  placeById,
  generationInput,
  outputLanguage
}) {
  let planDays = null;

  try {
    planDays = await buildAiSchedulePlan({
      candidates,
      dayCount,
      startDate: generationInput.startDate,
      stayPlace,
      generationInput
    });
  } catch (error) {
    console.error("AI schedule planning failed. Falling back to deterministic planner.", error);
    generationInput.aiFallback = {
      provider: "deterministic",
      reason: error?.message || "unknown"
    };
    planDays = buildSchedulePlan({
      candidates,
      dayCount,
      stayPlace,
      generationInput
    });
  }

  return sanitizePlanDaysForPersistence({
    planDays,
    placeById,
    outputLanguage,
    tripDays: generationInput.tripDays
  });
}

function resolvePlanningPreparation({ candidates, dayCount, generationInputBase, stayPlace }) {
  const planningMode = inferPlanningMode(candidates, generationInputBase);
  let planningSelection = null;

  try {
    planningSelection = selectCandidatesForAiPlanning(
      candidates,
      dayCount,
      {
        ...generationInputBase,
        planningMode
      },
      stayPlace
    );
  } catch (error) {
    if (error?.code === "AI_CANDIDATE_LIMIT_EXCEEDED") {
      fail(
        `AI 일정 생성에는 최대 ${MAX_AI_CANDIDATES}개 장소까지 사용할 수 있어요.`,
        "BAD_USER_INPUT",
        error.details || null
      );
    }
    throw error;
  }

  return {
    planningMode,
    planningCandidates: planningSelection.candidates,
    candidateTrim: planningSelection.metadata
  };
}

const resolvers = {
  JSON: GraphQLJSON,

  Query: {
    async health(_, __, context) {
      const { error } = await context.supabase.from(TABLES.places).select("id", { head: true, count: "exact" });
      assertSupabase(error, "Health check failed");
      return { status: "ok", timestamp: new Date().toISOString() };
    },

    async me(_, __, context) {
      return mapUser(await getOptionalUser(context));
    },

    async parseGoogleMapsLink(_, { url }) {
      return resolveGoogleMapsLink(url);
    },

    async places(_, { limit = 100, offset = 0 }, context) {
      await requireUser(context);
      const safeLimit = clamp(limit, 1, 200);
      const safeOffset = Math.max(0, offset);
      const { data, error } = await context.supabase
        .from(TABLES.places)
        .select("*")
        .order("created_at", { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);
      assertSupabase(error, "Failed to fetch places");
      return (data || []).map(mapPlace);
    },

    async place(_, { id }, context) {
      await requireUser(context);
      return mapPlace(await fetchPlaceById(context.supabase, id));
    },

    async placeByGooglePlaceId(_, { googlePlaceId }, context) {
      await requireUser(context);
      return mapPlace(await fetchPlaceByGooglePlaceId(context.supabase, googlePlaceId));
    },

    async myPlaceLists(_, { limit = 50, offset = 0 }, context) {
      const user = await requireUser(context);
      const safeLimit = clamp(limit, 1, 100);
      const safeOffset = Math.max(0, offset);
      const { data, error } = await context.supabase
        .from(TABLES.placeLists)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);
      assertSupabase(error, "Failed to fetch place lists");
      const placeLists = data || [];
      const previewData = await buildPlaceListPreviewData(
        context.supabase,
        placeLists.map((row) => row.id)
      );

      return placeLists.map((row) => ({
        ...mapPlaceList(row),
        itemCount: previewData.countsByListId.get(row.id) || 0,
        previewPlaces: previewData.previewPlacesByListId.get(row.id) || []
      }));
    },

    async placeList(_, { id }, context) {
      const user = await requireUser(context);
      const placeListRow = await fetchOwnedPlaceList(context.supabase, user.id, id);
      return placeListRow ? preloadPlaceListDetail(context.supabase, placeListRow) : null;
    },

    async mySchedules(_, { limit = 20, offset = 0 }, context) {
      const user = await requireUser(context);
      const safeLimit = clamp(limit, 1, 100);
      const safeOffset = Math.max(0, offset);
      const { data, error } = await context.supabase
        .from(TABLES.schedules)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);
      assertSupabase(error, "Failed to fetch schedules");
      const schedules = data || [];
      const placeListRows = await fetchOwnedPlaceListsByIds(
        context.supabase,
        user.id,
        schedules.map((row) => row.place_list_id)
      );
      const placeListById = new Map(placeListRows.map((row) => [row.id, mapPlaceList(row)]));

      return schedules.map((row) => ({
        ...mapSchedule(row),
        placeList: placeListById.get(row.place_list_id) || null
      }));
    },

    async schedule(_, { id }, context) {
      const user = await requireUser(context);
      const scheduleRow = await fetchOwnedSchedule(context.supabase, user.id, id);
      return scheduleRow ? preloadScheduleDetail(context.supabase, user.id, scheduleRow) : null;
    }
  },

  Mutation: {
    async signUp(_, { email, password }, context) {
      const { data, error } = await context.supabasePublic.auth.signUp({ email, password });
      assertSupabase(error, "Sign-up failed");
      return mapAuthPayload(data);
    },

    async signIn(_, { email, password }, context) {
      const { data, error } = await context.supabasePublic.auth.signInWithPassword({ email, password });
      assertSupabase(error, "Sign-in failed");
      return mapAuthPayload(data);
    },

    async signInWithGoogle(_, { redirectTo }, context) {
      const finalRedirect = redirectTo || process.env.OAUTH_REDIRECT_TO || undefined;
      const { data, error } = await context.supabasePublic.auth.signInWithOAuth({
        provider: "google",
        options: finalRedirect ? { redirectTo: finalRedirect } : undefined
      });
      assertSupabase(error, "Google OAuth initialization failed");
      return data?.url || "";
    },

    async deleteMyAccount(_, __, context) {
      const user = await requireUser(context);
      const adminClient = createSupabaseAdminClient();
      const { error } = await adminClient.auth.admin.deleteUser(user.id);
      assertSupabase(error, "Account deletion failed");
      return true;
    },

    async importPlaceListFromCrawler(_, { url, listName, city, description, language }, context) {
      const user = await requireUser(context);

      // 1. Scrape the list using Puppeteer
      const scrapedPlaces = await scrapeList(url);
      const normalizedScrapedPlaces = (scrapedPlaces || [])
        .map((placeData) => ({
          ...placeData,
          name: normalizeImportPlaceName(placeData?.name),
          note: typeof placeData?.note === "string" ? placeData.note.trim() || null : null
        }))
        .filter((placeData) => placeData.name);

      if (normalizedScrapedPlaces.length === 0) {
        fail("No places found at the provided URL", "BAD_USER_INPUT");
      }
      if (normalizedScrapedPlaces.length > MAX_PLACE_LIST_ITEMS) {
        fail(
          `Google Maps 리스트는 최대 ${MAX_PLACE_LIST_ITEMS}개 장소까지 가져올 수 있어요.`,
          "BAD_USER_INPUT"
        );
      }
      const importUsageTracker = createMonthlyImportUsageTracker(user.id, IMPORT_USAGE_SOURCES.googleMapsList);
      await importUsageTracker.ensurePlaceCapacity(normalizedScrapedPlaces.length);

      // 2. Import places first. If none succeed, do not create list.
      const apiKeyExists = hasGooglePlacesApiKey();
      const importedItems = [];
      const searchCache = new Map();
      const placeDetailsCache = new Map();
      const storedPlaceCache = new Map();

      for (const placeData of normalizedScrapedPlaces) {
        try {
          const searchQuery = `${placeData.name} ${city}`.trim();
          const searchResults = await fetchCachedSearchPlacesByText(searchCache, searchQuery, 5, {
            onMiss: () => importUsageTracker.recordSearchMiss()
          });
          const cityTokens = buildCityTokens(city);
          const cityMatched = (searchResults || []).find((place) =>
            includesCityToken(place?.formattedAddress, cityTokens)
          );
          const resolvedPlaceId = cityMatched?.id || searchResults[0]?.id;
          if (!resolvedPlaceId) {
            console.warn(`Could not resolve place ID for ${placeData.name}`);
            continue;
          }

          const existingPlace = await fetchCachedPlaceByGooglePlaceId(context.supabase, storedPlaceCache, resolvedPlaceId);
          if (existingPlace && isPlaceDetailsFresh(existingPlace)) {
            if (isImportBlockedBusinessStatus(existingPlace.business_status)) {
              console.warn(`Skipping non-importable place ${placeData.name}`, {
                businessStatus: existingPlace.business_status
              });
              continue;
            }

            importedItems.push({
              place_id: existingPlace.id,
              note: placeData.note ?? null,
              is_must_visit: false
            });
            continue;
          }

          let placePayload = {
            google_place_id: resolvedPlaceId,
            name: placeData.name || existingPlace?.name || null,
            google_maps_url: cityMatched?.googleMapsUri || searchResults[0]?.googleMapsUri || existingPlace?.google_maps_url || null
          };
          let placeRow = existingPlace;
          if (apiKeyExists) {
            const details = await fetchCachedPlaceDetails(placeDetailsCache, resolvedPlaceId, {
              onMiss: () => importUsageTracker.recordPlaceDetailsMiss()
            });
            placePayload = normalizePlacePayload(details, {
              googlePlaceId: resolvedPlaceId,
              name: placeData.name || existingPlace?.name || null,
              googleMapsUrl: cityMatched?.googleMapsUri || searchResults[0]?.googleMapsUri || existingPlace?.google_maps_url || null
            });
            if (isImportBlockedBusinessStatus(placePayload.business_status)) {
              console.warn(`Skipping non-importable place ${placeData.name}`, {
                businessStatus: placePayload.business_status
              });
              continue;
            }
            placeRow = await upsertSharedPlace(context.supabase, placePayload);
            storedPlaceCache.set(resolvedPlaceId, Promise.resolve(placeRow));
          } else if (!placeRow) {
            placeRow = await upsertSharedPlace(context.supabase, placePayload);
            storedPlaceCache.set(resolvedPlaceId, Promise.resolve(placeRow));
          }

          importedItems.push({
            place_id: placeRow.id,
            note: placeData.note ?? null,
            is_must_visit: false
          });
        } catch (e) {
          console.warn(`Could not import place ${placeData.name}`, e);
        }
      }

      if (importedItems.length === 0) {
        fail("가져올 수 있는 운영 중 장소가 없어요. 링크나 폐업 여부를 확인해 주세요.", "BAD_USER_INPUT");
      }

      const dedupedImportedItems = [];
      const importedItemByPlaceId = new Map();
      for (const item of importedItems) {
        const existingItem = importedItemByPlaceId.get(item.place_id);
        if (!existingItem) {
          importedItemByPlaceId.set(item.place_id, item);
          dedupedImportedItems.push(item);
          continue;
        }

        if (!existingItem.note && item.note) {
          existingItem.note = item.note;
        }
        existingItem.is_must_visit = existingItem.is_must_visit || item.is_must_visit;
      }

      if (dedupedImportedItems.length > MAX_PLACE_LIST_ITEMS) {
        fail(
          `리스트에는 최대 ${MAX_PLACE_LIST_ITEMS}개까지 담을 수 있어요.`,
          "BAD_USER_INPUT"
        );
      }

      // 3. Create list only after we have at least one imported place.
      const payload = {
        user_id: user.id,
        name: trimRequiredWithMaxLength(listName, "listName", MAX_PLACE_LIST_NAME_LENGTH),
        city: trimRequiredWithMaxLength(city, "city", MAX_PLACE_LIST_CITY_LENGTH),
        language: normalizeLanguage(language, DEFAULT_OUTPUT_LANGUAGE),
        description: description ?? null
      };
      const { data: listRow, error: listError } = await context.supabase.from(TABLES.placeLists).insert(payload).select("*").single();
      assertSupabase(listError, "Failed to create place list");

      // 4. Bulk attach imported places to the created list.
      const listItemsPayload = dedupedImportedItems.map((item, index) => ({
        list_id: listRow.id,
        place_id: item.place_id,
        note: item.note,
        is_must_visit: item.is_must_visit,
        sort_order: index + 1
      }));

      const { error: listItemsError } = await context.supabase.from(TABLES.placeListItems).upsert(listItemsPayload, {
        onConflict: "list_id,place_id"
      });
      if (listItemsError) {
        await context.supabase.from(TABLES.placeLists).delete().eq("id", listRow.id).eq("user_id", user.id);
        fail("Failed to save imported places to list", "INTERNAL_SERVER_ERROR", listItemsError.message);
      }

      return mapPlaceList(listRow);
    },

    async importPlaceFromGoogleLink(_, { url }, context) {
      const user = await requireUser(context);
      const importUsageTracker = createMonthlyImportUsageTracker(user.id, IMPORT_USAGE_SOURCES.googleMapsLink);
      const resolved = await resolveGoogleMapsLink(url, {
        onSearchByText: () => importUsageTracker.recordSearchMiss()
      });
      const placeDetailsCache = new Map();
      const storedPlaceCache = new Map();

      const rows = [];
      if (resolved.placeIds.length === 0) {
        const fallbackGooglePlaceId = `UNRESOLVED_${createHash("sha1").update(url).digest("hex").slice(0, 28)}`;
        const fallbackPayload = {
          google_place_id: fallbackGooglePlaceId,
          name: resolved.query || "Google 지도에서 가져온 장소",
          google_maps_url: url
        };
        rows.push(await upsertSharedPlace(context.supabase, fallbackPayload));
        return rows.map(mapPlace);
      }

      for (const placeId of resolved.placeIds) {
        const existingPlace = await fetchCachedPlaceByGooglePlaceId(context.supabase, storedPlaceCache, placeId);
        if (existingPlace && isPlaceDetailsFresh(existingPlace)) {
          if (isImportBlockedBusinessStatus(existingPlace.business_status)) {
            continue;
          }
          rows.push(existingPlace);
          continue;
        }

        let payload = {
          google_place_id: placeId,
          google_maps_url: url
        };
        let row = existingPlace;

        if (hasGooglePlacesApiKey()) {
          try {
            const details = await fetchCachedPlaceDetails(placeDetailsCache, placeId, {
              onMiss: () => importUsageTracker.recordPlaceDetailsMiss()
            });
            payload = normalizePlacePayload(details, { googlePlaceId: placeId, googleMapsUrl: url });
            if (isImportBlockedBusinessStatus(payload.business_status)) {
              continue;
            }
            row = await upsertSharedPlace(context.supabase, payload);
            storedPlaceCache.set(placeId, Promise.resolve(row));
          } catch {
            if (row && !isImportBlockedBusinessStatus(row.business_status)) {
              rows.push(row);
              continue;
            }
            payload = { ...payload, name: `Imported ${placeId}` };
          }
        }

        if (!row) {
          row = await upsertSharedPlace(context.supabase, payload);
          storedPlaceCache.set(placeId, Promise.resolve(row));
        }
        rows.push(row);
      }

      if (rows.length === 0) {
        fail("운영 중인 장소를 찾지 못했어요. 폐업했거나 아직 영업 전인 장소일 수 있어요.", "BAD_USER_INPUT");
      }

      return rows.map(mapPlace);
    },

    async upsertPlace(_, { input }, context) {
      await requireUser(context);

      const payload = {
        google_place_id: input.googlePlaceId,
        name: input.name ?? null,
        formatted_address: input.formattedAddress ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        rating: input.rating ?? null,
        user_rating_count: input.userRatingCount ?? null,
        price_level: input.priceLevel ?? null,
        types_raw: Array.isArray(input.typesRaw) ? input.typesRaw : [],
        primary_type: input.primaryType ?? null,
        business_status: null,
        categories: derivePlaceCategories({
          types: Array.isArray(input.typesRaw) ? input.typesRaw : [],
          primaryType: input.primaryType ?? null
        }),
        opening_hours: input.openingHours ?? null,
        photos: Array.isArray(input.photos) ? input.photos : [],
        website: input.website ?? null,
        google_maps_url: input.googleMapsUrl ?? null
      };

      const row = await upsertSharedPlace(context.supabase, payload);
      return mapPlace(row);
    },

    async refreshPlaceDetails(_, { id }, context) {
      await requireUser(context);
      const existing = await fetchPlaceById(context.supabase, id);
      if (!existing) fail("Place not found", "NOT_FOUND");
      if (!existing.google_place_id) fail("googlePlaceId is missing", "BAD_USER_INPUT");

      const details = await fetchPlaceDetailsById(existing.google_place_id);
      const patch = normalizePlacePayload(details, {
        googlePlaceId: existing.google_place_id,
        name: existing.name,
        formattedAddress: existing.formatted_address,
        addressComponents: existing.address_components,
        lat: existing.lat,
        lng: existing.lng,
        rating: existing.rating,
        userRatingCount: existing.user_rating_count,
        priceLevel: existing.price_level,
        typesRaw: existing.types_raw,
        primaryType: existing.primary_type,
        businessStatus: existing.business_status,
        openingHours: existing.opening_hours,
        photos: existing.photos,
        website: existing.website,
        googleMapsUrl: existing.google_maps_url
      });

      const { data, error } = await context.supabase
        .from(TABLES.places)
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      assertSupabase(error, "Failed to refresh place details");
      return mapPlace(data);
    },

    async createPlaceList(_, { input }, context) {
      const user = await requireUser(context);
      const payload = {
        user_id: user.id,
        name: trimRequiredWithMaxLength(input.name, "name", MAX_PLACE_LIST_NAME_LENGTH),
        city: trimRequiredWithMaxLength(input.city, "city", MAX_PLACE_LIST_CITY_LENGTH),
        language: normalizeLanguage(input.language, DEFAULT_OUTPUT_LANGUAGE),
        description: input.description ?? null
      };

      const { data, error } = await context.supabase.from(TABLES.placeLists).insert(payload).select("*").single();
      assertSupabase(error, "Failed to create place list");
      return mapPlaceList(data);
    },

    async updatePlaceList(_, { id, input }, context) {
      const user = await requireUser(context);
      const existing = await fetchOwnedPlaceList(context.supabase, user.id, id);
      if (!existing) fail("Place list not found", "NOT_FOUND");

      const patch = {};
      if (typeof input.name === "string") patch.name = trimRequiredWithMaxLength(input.name, "name", MAX_PLACE_LIST_NAME_LENGTH);
      if (typeof input.city === "string") patch.city = trimRequiredWithMaxLength(input.city, "city", MAX_PLACE_LIST_CITY_LENGTH);
      if (Object.prototype.hasOwnProperty.call(input, "language")) {
        patch.language = normalizeLanguage(input.language, normalizeLanguage(existing.language, DEFAULT_OUTPUT_LANGUAGE));
      }
      if (Object.prototype.hasOwnProperty.call(input, "description")) patch.description = input.description ?? null;
      if (Object.keys(patch).length === 0) fail("No fields provided for update", "BAD_USER_INPUT");

      const { data, error } = await context.supabase
        .from(TABLES.placeLists)
        .update(patch)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single();
      assertSupabase(error, "Failed to update place list");
      return mapPlaceList(data);
    },

    async deletePlaceList(_, { id }, context) {
      const user = await requireUser(context);
      const { data, error } = await context.supabase
        .from(TABLES.placeLists)
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      assertSupabase(error, "Failed to delete place list");
      return Boolean(data?.id);
    },

    async addPlaceListItem(_, { input }, context) {
      const user = await requireUser(context);
      const list = await fetchOwnedPlaceList(context.supabase, user.id, input.listId);
      if (!list) fail("Place list not found", "NOT_FOUND");

      const place = await fetchPlaceById(context.supabase, input.placeId);
      if (!place) fail("Place not found", "NOT_FOUND");

      const existing = await fetchPlaceListItemByListAndPlaceId(context.supabase, input.listId, input.placeId);

      if (existing) {
        const { error } = await context.supabase
          .from(TABLES.placeListItems)
          .update({
            note: input.note ?? null,
            is_must_visit: Boolean(input.isMustVisit)
          })
          .eq("id", existing.id);
        assertSupabase(error, "Failed to update existing place list item");
      } else {
        const itemCount = await fetchPlaceListItemCount(context.supabase, input.listId);
        if (itemCount >= MAX_PLACE_LIST_ITEMS) {
          fail(
            `리스트에는 최대 ${MAX_PLACE_LIST_ITEMS}개까지 담을 수 있어요.`,
            "BAD_USER_INPUT"
          );
        }
        const sortOrder = await fetchNextPlaceListSortOrder(context.supabase, input.listId);
        const { error } = await context.supabase.from(TABLES.placeListItems).insert({
          list_id: input.listId,
          place_id: input.placeId,
          note: input.note ?? null,
          is_must_visit: Boolean(input.isMustVisit),
          sort_order: sortOrder
        });
        assertSupabase(error, "Failed to add place to list");
      }

      return mapPlaceList(await fetchOwnedPlaceList(context.supabase, user.id, input.listId));
    },

    async updatePlaceListItem(_, { id, input }, context) {
      const user = await requireUser(context);
      const existing = await ensureOwnedPlaceListItem(context.supabase, user.id, id);
      if (!existing) fail("Place list item not found", "NOT_FOUND");

      const patch = {};
      if (Object.prototype.hasOwnProperty.call(input, "note")) patch.note = input.note ?? null;
      if (Object.prototype.hasOwnProperty.call(input, "isMustVisit")) patch.is_must_visit = Boolean(input.isMustVisit);
      if (Object.keys(patch).length === 0) fail("No fields provided for update", "BAD_USER_INPUT");

      const { data, error } = await context.supabase
        .from(TABLES.placeListItems)
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      assertSupabase(error, "Failed to update place list item");
      return mapPlaceListItem(data);
    },

    async removePlaceListItem(_, { id }, context) {
      const user = await requireUser(context);
      const existing = await ensureOwnedPlaceListItem(context.supabase, user.id, id);
      if (!existing) fail("Place list item not found", "NOT_FOUND");

      const { data, error } = await context.supabase
        .from(TABLES.placeListItems)
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();
      assertSupabase(error, "Failed to remove place list item");
      return Boolean(data?.id);
    },

    async createSchedule(_, { input }, context) {
      const user = await requireUser(context);
      const list = await fetchOwnedPlaceList(context.supabase, user.id, input.placeListId);
      if (!list) fail("placeListId is invalid", "BAD_USER_INPUT");

      const startDate = input.startDate;
      const endDate = input.endDate;
      const dayCount = computeDayCount(startDate, endDate);
      const themes = normalizeThemes(input.themes);

      const { items, candidates, placeById } = await fetchPlaceListCandidates(context.supabase, list.id);
      if (candidates.length === 0) {
        fail("Selected place list has no places", "BAD_USER_INPUT");
      }

      const schedulableCandidates = filterSchedulableCandidates(candidates);
      if (schedulableCandidates.length === 0) {
        fail("숙소를 제외하면 추천 일정으로 만들 수 있는 장소가 없어요. 다른 장소를 더 추가해 주세요.", "BAD_USER_INPUT");
      }

      const candidatePreprocess = preprocessCandidatesForSchedule({
        candidates: schedulableCandidates,
        cityName: list.city
      });
      if (candidatePreprocess.candidates.length === 0) {
        fail("리스트 전처리 후 일정 후보가 남지 않았어요. 장소를 다시 확인해 주세요.", "BAD_USER_INPUT");
      }

      assertMustVisitLimit({
        candidates: candidatePreprocess.candidates,
        dayCount,
        limit: resolveFinalMustVisitLimit(dayCount, input.pace)
      });

      const stayPlaceId = input.stayPlaceId || null;
      const stayListItem = stayPlaceId ? items.find((item) => item.place_id === stayPlaceId) || null : null;
      if (stayPlaceId && !stayListItem) {
        fail("선택한 숙소가 저장 리스트에 없어요. 다시 선택해 주세요.", "BAD_USER_INPUT");
      }
      const stayPlace = stayPlaceId ? placeById.get(stayPlaceId) || null : null;
      if (stayPlaceId && !stayPlace) {
        fail("선택한 숙소 정보를 찾지 못했어요. 다시 선택해 주세요.", "BAD_USER_INPUT");
      }

      const outputLanguage = normalizeLanguage(
        input.outputLanguage,
        normalizeLanguage(list.language, DEFAULT_OUTPUT_LANGUAGE)
      );

      const generationInputBase = buildGenerationInput({
        startDate,
        endDate,
        city: list.city,
        companions: input.companions,
        pace: normalizePace(input.pace),
        themes,
        placeListId: list.id,
        stayPlaceId,
        candidatePreprocess: candidatePreprocess.preprocessing,
        outputLanguage,
        dayCount
      });
      const { planningMode, planningCandidates, candidateTrim } = resolvePlanningPreparation({
        candidates: candidatePreprocess.candidates,
        dayCount,
        generationInputBase,
        stayPlace
      });
      const generationInput = buildGenerationInput({
        ...generationInputBase,
        planningMode,
        candidateTrim,
        dayBudgetMinutes: resolveDayBudgetMinutes(generationInputBase)
      });

      const aiUsageTracker = createAiUsageTracker(user.id, AI_USAGE_SOURCES.createSchedule);
      await aiUsageTracker.recordUsage();

      const planDays = await resolveSchedulePlanDays({
        candidates: planningCandidates,
        dayCount,
        stayPlace,
        placeById,
        generationInput,
        outputLanguage
      });

      const stayRecommendation = stayPlace ? null : buildStayRecommendation(planDays, placeById);

      const { data: scheduleRow, error: scheduleError } = await context.supabase
        .from(TABLES.schedules)
        .insert({
          user_id: user.id,
          title: trimRequired(input.title, "title"),
          start_date: startDate,
          end_date: endDate,
          day_count: dayCount,
          place_list_id: list.id,
          stay_place_id: stayPlaceId,
          stay_recommendation: stayRecommendation,
          companions: input.companions ?? null,
          pace: normalizePace(input.pace) ?? null,
          themes,
          output_language: outputLanguage,
          generation_input: generationInput,
          generation_version: GENERATION_VERSION,
          is_manual_modified: false
        })
        .select("*")
        .single();
      assertSupabase(scheduleError, "Failed to create schedule");

      await writeScheduleDaysAndStops({
        supabase: context.supabase,
        scheduleId: scheduleRow.id,
        planDays,
        startDate
      });

      return mapSchedule(scheduleRow);
    },

    async regenerateSchedule(_, { scheduleId, input }, context) {
      const user = await requireUser(context);
      const existing = await fetchOwnedSchedule(context.supabase, user.id, scheduleId);
      if (!existing) fail("Schedule not found", "NOT_FOUND");

      const startDate = input.startDate || existing.start_date;
      const endDate = input.endDate || existing.end_date;
      if (!startDate || !endDate) {
        fail("startDate and endDate are required for regeneration", "BAD_USER_INPUT");
      }

      const dayCount = computeDayCount(startDate, endDate);
      const placeListId = input.placeListId || existing.place_list_id;
      if (!placeListId) {
        fail("placeListId is missing", "BAD_USER_INPUT");
      }

      const list = await fetchOwnedPlaceList(context.supabase, user.id, placeListId);
      if (!list) fail("placeListId is invalid", "BAD_USER_INPUT");

      const themes = Object.prototype.hasOwnProperty.call(input, "themes")
        ? normalizeThemes(input.themes)
        : normalizeThemes(existing.themes);
      const companions = Object.prototype.hasOwnProperty.call(input, "companions")
        ? input.companions
        : existing.companions;
      const pace = Object.prototype.hasOwnProperty.call(input, "pace") ? input.pace : existing.pace;
      const outputLanguage = Object.prototype.hasOwnProperty.call(input, "outputLanguage")
        ? normalizeLanguage(input.outputLanguage, normalizeLanguage(list.language, DEFAULT_OUTPUT_LANGUAGE))
        : normalizeLanguage(list.language || existing.output_language, DEFAULT_OUTPUT_LANGUAGE);

      const { items, candidates, placeById } = await fetchPlaceListCandidates(context.supabase, list.id);
      const stayPlaceId = Object.prototype.hasOwnProperty.call(input, "stayPlaceId")
        ? input.stayPlaceId || null
        : placeListId === existing.place_list_id
          ? existing.stay_place_id || null
          : null;
      const stayListItem = stayPlaceId ? items.find((item) => item.place_id === stayPlaceId) || null : null;
      if (stayPlaceId && !stayListItem) {
        fail("선택한 숙소가 저장 리스트에 없어요. 다시 선택해 주세요.", "BAD_USER_INPUT");
      }
      const stayPlace = stayPlaceId ? placeById.get(stayPlaceId) || null : null;
      if (stayPlaceId && !stayPlace) {
        fail("선택한 숙소 정보를 찾지 못했어요. 다시 선택해 주세요.", "BAD_USER_INPUT");
      }

      if (candidates.length === 0) {
        fail("Selected place list has no places", "BAD_USER_INPUT");
      }

      const schedulableCandidates = filterSchedulableCandidates(candidates);
      if (schedulableCandidates.length === 0) {
        fail("숙소를 제외하면 추천 일정으로 만들 수 있는 장소가 없어요. 다른 장소를 더 추가해 주세요.", "BAD_USER_INPUT");
      }

      const candidatePreprocess = preprocessCandidatesForSchedule({
        candidates: schedulableCandidates,
        cityName: list.city
      });
      if (candidatePreprocess.candidates.length === 0) {
        fail("리스트 전처리 후 일정 후보가 남지 않았어요. 장소를 다시 확인해 주세요.", "BAD_USER_INPUT");
      }

      const normalizedPace = normalizePace(pace);
      assertMustVisitLimit({
        candidates: candidatePreprocess.candidates,
        dayCount,
        limit: resolveFinalMustVisitLimit(dayCount, normalizedPace)
      });

      const generationInputBase = buildGenerationInput({
        startDate,
        endDate,
        city: list.city,
        companions,
        pace: normalizedPace,
        themes,
        placeListId: list.id,
        stayPlaceId,
        candidatePreprocess: candidatePreprocess.preprocessing,
        outputLanguage,
        dayCount
      });
      const { planningMode, planningCandidates, candidateTrim } = resolvePlanningPreparation({
        candidates: candidatePreprocess.candidates,
        dayCount,
        generationInputBase,
        stayPlace
      });
      const generationInput = buildGenerationInput({
        ...generationInputBase,
        planningMode,
        candidateTrim,
        dayBudgetMinutes: resolveDayBudgetMinutes(generationInputBase)
      });

      const aiUsageTracker = createAiUsageTracker(user.id, AI_USAGE_SOURCES.regenerateSchedule);
      await aiUsageTracker.recordUsage();

      const planDays = await resolveSchedulePlanDays({
        candidates: planningCandidates,
        dayCount,
        stayPlace,
        placeById,
        generationInput,
        outputLanguage
      });

      const stayRecommendation = stayPlace ? null : buildStayRecommendation(planDays, placeById);

      const { data: updatedSchedule, error: updateError } = await context.supabase
        .from(TABLES.schedules)
        .update({
          title: trimRequired(existing.title, "title"),
          start_date: startDate,
          end_date: endDate,
          day_count: dayCount,
          place_list_id: list.id,
          stay_place_id: stayPlaceId ?? null,
          stay_recommendation: stayRecommendation,
          companions: companions ?? null,
          pace: normalizedPace ?? null,
          themes,
          output_language: outputLanguage,
          generation_input: generationInput,
          generation_version: GENERATION_VERSION,
          is_manual_modified: false
        })
        .eq("id", scheduleId)
        .eq("user_id", user.id)
        .select("*")
        .single();
      assertSupabase(updateError, "Failed to update schedule");

      const { error: deleteDaysError } = await context.supabase
        .from(TABLES.scheduleDays)
        .delete()
        .eq("schedule_id", scheduleId);
      assertSupabase(deleteDaysError, "Failed to reset schedule days");

      await writeScheduleDaysAndStops({
        supabase: context.supabase,
        scheduleId,
        planDays,
        startDate
      });

      return mapSchedule(updatedSchedule);
    },

    async moveScheduleStop(_, { scheduleId, input }, context) {
      const user = await requireUser(context);
      const schedule = await fetchOwnedSchedule(context.supabase, user.id, scheduleId);
      if (!schedule) fail("Schedule not found", "NOT_FOUND");

      const { data: dayRows, error: dayError } = await context.supabase
        .from(TABLES.scheduleDays)
        .select("id,day_number")
        .eq("schedule_id", scheduleId)
        .order("day_number", { ascending: true });
      assertSupabase(dayError, "Failed to fetch schedule days");

      const targetDay = (dayRows || []).find((row) => row.day_number === input.targetDayNumber);
      if (!targetDay) fail("targetDayNumber is invalid", "BAD_USER_INPUT");

      const dayIds = (dayRows || []).map((row) => row.id);
      const { data: stopRows, error: stopError } = await context.supabase
        .from(TABLES.scheduleStops)
        .select("*")
        .in("schedule_day_id", dayIds)
        .order("stop_order", { ascending: true });
      assertSupabase(stopError, "Failed to fetch schedule stops");

      const movingStop = (stopRows || []).find((row) => row.id === input.stopId);
      if (!movingStop) fail("stopId is invalid", "BAD_USER_INPUT");

      const byDay = new Map(dayIds.map((id) => [id, []]));
      for (const row of stopRows || []) {
        byDay.get(row.schedule_day_id).push(row);
      }

      const source = [...byDay.get(movingStop.schedule_day_id)];
      const target = movingStop.schedule_day_id === targetDay.id ? source : [...byDay.get(targetDay.id)];

      const sourceIndex = source.findIndex((row) => row.id === movingStop.id);
      source.splice(sourceIndex, 1);

      const insertIndex = clamp(input.targetOrder - 1, 0, target.length);
      target.splice(insertIndex, 0, movingStop);

      const plans =
        movingStop.schedule_day_id === targetDay.id
          ? [{ dayId: targetDay.id, rows: target }]
          : [
              { dayId: movingStop.schedule_day_id, rows: source },
              { dayId: targetDay.id, rows: target }
            ];

      for (const plan of plans) {
        for (let index = 0; index < plan.rows.length; index += 1) {
          const row = plan.rows[index];
          const { error } = await context.supabase
            .from(TABLES.scheduleStops)
            .update({
              schedule_day_id: plan.dayId,
              stop_order: index + 1,
              is_user_modified: true
            })
            .eq("id", row.id);
          assertSupabase(error, "Failed to reorder schedule stops");
        }
      }

      const { error: scheduleError } = await context.supabase
        .from(TABLES.schedules)
        .update({ is_manual_modified: true })
        .eq("id", scheduleId)
        .eq("user_id", user.id);
      assertSupabase(scheduleError, "Failed to update manual state");

      return mapSchedule(await fetchOwnedSchedule(context.supabase, user.id, scheduleId));
    },

    async saveScheduleEdits(_, { scheduleId, input }, context) {
      const user = await requireUser(context);
      const schedule = await fetchOwnedSchedule(context.supabase, user.id, scheduleId);
      if (!schedule) fail("Schedule not found", "NOT_FOUND");

      const { data: dayRows, error: dayError } = await context.supabase
        .from(TABLES.scheduleDays)
        .select("id,day_number,date")
        .eq("schedule_id", scheduleId)
        .order("day_number", { ascending: true });
      assertSupabase(dayError, "Failed to fetch schedule days");

      const expectedDayRows = dayRows || [];
      const dayRowsByNumber = new Map(expectedDayRows.map((row) => [row.day_number, row]));
      const inputDays = Array.isArray(input?.days) ? input.days : [];

      if (inputDays.length !== expectedDayRows.length) {
        fail("days must include every schedule day", "BAD_USER_INPUT");
      }

      const seenDayNumbers = new Set();
      for (const dayInput of inputDays) {
        const dayNumber = Number(dayInput?.dayNumber);
        if (!Number.isInteger(dayNumber) || !dayRowsByNumber.has(dayNumber)) {
          fail("dayNumber is invalid", "BAD_USER_INPUT");
        }
        if (seenDayNumbers.has(dayNumber)) {
          fail("dayNumber must be unique", "BAD_USER_INPUT");
        }
        seenDayNumbers.add(dayNumber);
      }

      const { items: placeListItems, placeById: placeRowsById } = await fetchPlaceListCandidates(
        context.supabase,
        schedule.place_list_id
      );
      const allowedPlaceIds = new Set((placeListItems || []).map((item) => item.place_id));
      const mappedPlaceById = new Map(
        [...placeRowsById.entries()].map(([placeId, placeRow]) => [placeId, mapPlace(placeRow)])
      );

      const allPlaceIds = [];
      for (const dayInput of inputDays) {
        const stops = Array.isArray(dayInput?.stops) ? dayInput.stops : [];
        for (const stopInput of stops) {
          const placeId = String(stopInput?.placeId || "").trim();
          if (!placeId) {
            fail("placeId is required", "BAD_USER_INPUT");
          }
          if (!allowedPlaceIds.has(placeId)) {
            fail("All edited stops must belong to the schedule place list", "BAD_USER_INPUT");
          }
          if (!mappedPlaceById.has(placeId)) {
            fail("Place data is missing for an edited stop", "BAD_USER_INPUT");
          }
          allPlaceIds.push(placeId);
        }
      }

      if (new Set(allPlaceIds).size !== allPlaceIds.length) {
        fail("Each place can only appear once in a saved schedule", "BAD_USER_INPUT");
      }

      const nextStopsByDayNumber = new Map(
        inputDays.map((dayInput) => [Number(dayInput.dayNumber), buildManualScheduleStopSnapshot(dayInput, mappedPlaceById)])
      );
      const dayIds = expectedDayRows.map((row) => row.id);

      if (dayIds.length > 0) {
        const { error: deleteError } = await context.supabase
          .from(TABLES.scheduleStops)
          .delete()
          .in("schedule_day_id", dayIds);
        assertSupabase(deleteError, "Failed to replace schedule stops");
      }

      const stopPayload = expectedDayRows.flatMap((dayRow) =>
        (nextStopsByDayNumber.get(dayRow.day_number) || []).map((stop) => ({
          schedule_day_id: dayRow.id,
          stop_order: stop.stopOrder,
          place_id: stop.placeId,
          time: null,
          label: null,
          is_must_visit: stop.isMustVisit,
          note: stop.note,
          reason: null,
          visit_tip: null,
          transport_to_next: stop.transportToNext,
          is_user_modified: true
        }))
      );

      if (stopPayload.length > 0) {
        const { error: insertError } = await context.supabase.from(TABLES.scheduleStops).insert(stopPayload);
        assertSupabase(insertError, "Failed to save edited schedule stops");
      }

      const { error: scheduleError } = await context.supabase
        .from(TABLES.schedules)
        .update({ is_manual_modified: true })
        .eq("id", scheduleId)
        .eq("user_id", user.id);
      assertSupabase(scheduleError, "Failed to update manual state");

      const updatedSchedule = await fetchOwnedSchedule(context.supabase, user.id, scheduleId);
      return preloadScheduleDetail(context.supabase, user.id, updatedSchedule);
    },

    async updateScheduleStop(_, { scheduleId, input }, context) {
      const user = await requireUser(context);
      const schedule = await fetchOwnedSchedule(context.supabase, user.id, scheduleId);
      if (!schedule) fail("Schedule not found", "NOT_FOUND");
      if (!Object.prototype.hasOwnProperty.call(input, "note")) fail("No fields provided for update", "BAD_USER_INPUT");

      const existing = await fetchOwnedScheduleStop(context.supabase, scheduleId, input.stopId);
      if (!existing) fail("Schedule stop not found", "NOT_FOUND");

      const note = typeof input.note === "string" ? input.note.trim() : null;
      const patch = {
        note: note || null,
        is_user_modified: true
      };

      const { data, error } = await context.supabase
        .from(TABLES.scheduleStops)
        .update(patch)
        .eq("id", input.stopId)
        .select("*")
        .single();
      assertSupabase(error, "Failed to update schedule stop");

      return mapScheduleStop(data);
    },

    async deleteSchedule(_, { id }, context) {
      const user = await requireUser(context);
      const { data, error } = await context.supabase
        .from(TABLES.schedules)
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      assertSupabase(error, "Failed to delete schedule");
      return Boolean(data?.id);
    }
  },

  PlaceList: {
    async itemCount(list, _, context) {
      if (typeof list.itemCount === "number") {
        return list.itemCount;
      }

      const { count, error } = await context.supabase
        .from(TABLES.placeListItems)
        .select("id", { head: true, count: "exact" })
        .eq("list_id", list.id);
      assertSupabase(error, "Failed to count place list items");
      return count || 0;
    },

    async items(list, _, context) {
      if (Array.isArray(list.items)) {
        return list.items;
      }

      const { data, error } = await context.supabase
        .from(TABLES.placeListItems)
        .select("*")
        .eq("list_id", list.id)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });
      assertSupabase(error, "Failed to fetch place list items");
      return (data || []).map(mapPlaceListItem);
    },

    async previewPlaces(list, { limit = 4 }, context) {
      const safeLimit = clamp(limit, 1, 8);
      if (Array.isArray(list.previewPlaces) && safeLimit <= 4) {
        return list.previewPlaces.slice(0, safeLimit);
      }

      const { data: itemRows, error: itemError } = await context.supabase
        .from(TABLES.placeListItems)
        .select("place_id")
        .eq("list_id", list.id)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .limit(safeLimit);
      assertSupabase(itemError, "Failed to fetch preview place list items");

      const placeIds = (itemRows || []).map((row) => row.place_id).filter(Boolean);
      if (placeIds.length === 0) {
        return [];
      }

      const { data: placeRows, error: placeError } = await context.supabase
        .from(TABLES.places)
        .select("*")
        .in("id", placeIds);
      assertSupabase(placeError, "Failed to fetch preview places");

      const byId = new Map((placeRows || []).map((row) => [row.id, row]));
      return placeIds.map((placeId) => byId.get(placeId)).filter(Boolean).map(mapPlace);
    }
  },

  PlaceListItem: {
    async place(item, _, context) {
      if (item.place) {
        return item.place;
      }

      const row = await fetchPlaceById(context.supabase, item.placeId);
      if (!row) fail("Place not found", "NOT_FOUND");
      return mapPlace(row);
    }
  },

  Schedule: {
    async placeList(schedule, _, context) {
      if (schedule.placeList) {
        return schedule.placeList;
      }

      const row = await fetchOwnedPlaceList(context.supabase, schedule.userId, schedule.placeListId);
      if (!row) fail("Place list not found", "NOT_FOUND");
      return mapPlaceList(row);
    },

    async stayPlace(schedule, _, context) {
      if (schedule.stayPlace || schedule.stayPlaceId === null) {
        return schedule.stayPlace;
      }

      if (!schedule.stayPlaceId) return null;
      return mapPlace(await fetchPlaceById(context.supabase, schedule.stayPlaceId));
    },

    async days(schedule, _, context) {
      if (Array.isArray(schedule.days)) {
        return schedule.days;
      }

      const { data, error } = await context.supabase
        .from(TABLES.scheduleDays)
        .select("*")
        .eq("schedule_id", schedule.id)
        .order("day_number", { ascending: true });
      assertSupabase(error, "Failed to fetch schedule days");
      return (data || []).map(mapScheduleDay);
    }
  },

  ScheduleDay: {
    async stops(day, _, context) {
      if (Array.isArray(day.stops)) {
        return day.stops;
      }

      const { data, error } = await context.supabase
        .from(TABLES.scheduleStops)
        .select("*")
        .eq("schedule_day_id", day.id)
        .order("stop_order", { ascending: true });
      assertSupabase(error, "Failed to fetch schedule stops");
      return (data || []).map(mapScheduleStop);
    }
  },

  ScheduleStop: {
    async place(stop, _, context) {
      if (stop.place) {
        return stop.place;
      }

      const row = await fetchPlaceById(context.supabase, stop.placeId);
      if (!row) fail("Place not found", "NOT_FOUND");
      return mapPlace(row);
    }
  }
};

module.exports = { resolvers };
