const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  getGeminiConfig,
  getOpenAIConfig,
  resolveAiProviderPreference
} = require("./env");
const {
  buildSchedulePlan,
  buildPromptOpeningSummary,
  evaluateCandidateVisitWindow,
  filterNonLodgingCandidates,
  getCandidateTraits,
  inferPlanningMode,
  resolveCandidateClusterHint,
  resolveCandidateSlotFit,
  resolveDayBudgetMinutes,
  resolveLabelAnchorMinutes
} = require("./scheduleEngine");
const {
  ROUTE_STOP_LABEL_FALLBACK,
  ROUTE_STOP_LABEL_VALUES,
  buildCanonicalRouteStopLabel
} = require("./route-taxonomy");
const { sanitizeScheduledDayStops } = require("./scheduleStopSanitizer");

const DEFAULT_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];
const DEFAULT_OPENAI_MODELS = ["gpt-5-nano", "gpt-4.1-nano", "gpt-4o-mini", "gpt-4.1-mini"];
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const SUPPORTED_AI_PROVIDERS = new Set(["gemini", "openai"]);
const DINNER_START_MINUTES = 17 * 60;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every((value) => Number.isFinite(Number(value)))) {
    return null;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function getGeminiApiKey() {
  return getGeminiConfig().apiKey;
}

function ensureGeminiKey() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  return apiKey;
}

function getGeminiModelCandidates() {
  const { model: primaryModel } = getGeminiConfig();
  const candidates = [primaryModel, ...DEFAULT_GEMINI_MODELS].filter(Boolean);
  return [...new Set(candidates)];
}

function getOpenAIApiKey() {
  return getOpenAIConfig().apiKey;
}

function ensureOpenAIKey() {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return apiKey;
}

function getOpenAIModelCandidates() {
  const { model: primaryModel } = getOpenAIConfig();
  const candidates = [primaryModel, ...DEFAULT_OPENAI_MODELS].filter(Boolean);
  return [...new Set(candidates)];
}

function resolveAiProvider() {
  const requestedProvider = resolveAiProviderPreference();

  if (SUPPORTED_AI_PROVIDERS.has(requestedProvider)) {
    return requestedProvider;
  }

  if (getOpenAIApiKey() && !getGeminiApiKey()) {
    return "openai";
  }

  return "gemini";
}

function parseTimeToMinutes(value) {
  if (typeof value !== "string") return Number.POSITIVE_INFINITY;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return Number.POSITIVE_INFINITY;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.POSITIVE_INFINITY;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return Number.POSITIVE_INFINITY;
  return hour * 60 + minute;
}

function minutesToTimeString(minutes) {
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric)) return null;
  const normalized = Math.max(0, Math.round(numeric));
  const hour = String(Math.floor(normalized / 60) % 24).padStart(2, "0");
  const minute = String(normalized % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function normalizeStopOrder(stops) {
  const orderedStops = [...(stops || [])]
    .map((stop, index) => ({ stop, index }))
    .sort((left, right) => {
      const timeDiff = parseTimeToMinutes(left.stop?.time) - parseTimeToMinutes(right.stop?.time);
      if (timeDiff !== 0) return timeDiff;
      return left.index - right.index;
    })
    .map((entry) => entry.stop);

  return orderedStops.map((stop, index) => ({
    ...stop,
    label: stop.label || buildCanonicalRouteStopLabel(index, orderedStops.length)
  }));
}

function roundCoordinate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(4)) : null;
}

function resolveDistanceFromStayMeters(candidate, stayPlace = null) {
  if (!stayPlace || stayPlace.lat == null || stayPlace.lng == null) {
    return null;
  }

  if (candidate?.place?.lat == null || candidate?.place?.lng == null) {
    return null;
  }

  const distanceKm = haversineKm(stayPlace.lat, stayPlace.lng, candidate.place.lat, candidate.place.lng);
  return Number.isFinite(distanceKm) ? Math.round(distanceKm * 1000) : null;
}

function resolveCompanionsLabel(companions) {
  const normalized = String(companions || "").trim().toUpperCase();
  if (normalized === "SOLO") return "혼자";
  if (normalized === "FRIENDS") return "친구";
  if (normalized === "COUPLE") return "연인";
  if (normalized === "FAMILY") return "가족";
  if (normalized === "GROUP") return "여럿";
  return companions || null;
}

function resolvePaceLabel(pace) {
  const normalized = String(pace || "").trim().toUpperCase();
  if (normalized === "RELAXED") return "여유롭게";
  if (normalized === "INTENSE") return "알차게";
  if (normalized === "MODERATE") return "적당히";
  return pace || null;
}

function resolveThemeLabel(theme) {
  const normalized = String(theme || "").trim().toUpperCase();
  if (normalized === "FOODIE") return "맛집";
  if (normalized === "LANDMARK") return "랜드마크";
  if (normalized === "SHOPPING") return "쇼핑";
  if (normalized === "NATURE") return "자연";
  return theme || null;
}

function buildTripPayload(generationInput = {}) {
  const tripDays = Array.isArray(generationInput.tripDays) ? generationInput.tripDays : [];
  const travelDates = {};
  for (const tripDay of tripDays) {
    travelDates[String(tripDay.day)] = tripDay.date;
  }

  return {
    city: generationInput.city || null,
    travel_dates: travelDates,
    companions: resolveCompanionsLabel(generationInput.companions),
    pace: resolvePaceLabel(generationInput.pace),
    themes: (Array.isArray(generationInput.themes) ? generationInput.themes : [])
      .map(resolveThemeLabel)
      .filter(Boolean),
    day_budget_minutes: resolveDayBudgetMinutes(generationInput),
    planning_mode: inferPlanningMode([], generationInput)
  };
}

function buildStayPayload(stayPlace = null) {
  if (!stayPlace) return null;
  return {
    placeId: stayPlace.id,
    name: stayPlace.name || null,
    coord: [roundCoordinate(stayPlace.lat), roundCoordinate(stayPlace.lng)]
  };
}

function buildPlacePayload(candidate, generationInput = {}, stayPlace = null) {
  const place = candidate.place || {};
  const traits = getCandidateTraits(candidate);
  const openingSummary = buildPromptOpeningSummary(candidate, generationInput.tripDays || []);

  return {
    placeId: place.id,
    name: place.name || null,
    coord: [roundCoordinate(place.lat), roundCoordinate(place.lng)],
    categories: Array.isArray(place.categories) ? place.categories : [],
    primaryType: place.primary_type || place.primaryType || null,
    slotFit: resolveCandidateSlotFit(candidate),
    must_visit: Boolean(candidate.isMustVisit),
    userNote: candidate.note || null,
    opening_summary: openingSummary,
    duration_estimate_min: Math.max(20, Math.round(traits.baseVisitDurationMinutes || 75)),
    cluster_hint: resolveCandidateClusterHint(candidate),
    distance_from_stay_m: resolveDistanceFromStayMeters(candidate, stayPlace),
    quality_hint: {
      rating: traits.rating,
      review_count: traits.reviewCount,
      fame_score: Number((traits.fameScore || 0).toFixed(3)),
      reservation_risk: Boolean(traits.reservationRisk)
    }
  };
}

function buildPlannerPayload({ candidates, generationInput, stayPlace }) {
  return {
    trip: buildTripPayload(generationInput),
    stay: buildStayPayload(stayPlace),
    places: (candidates || []).map((candidate) => buildPlacePayload(candidate, generationInput, stayPlace))
  };
}

function buildSystemPrompt() {
  return `You are an AI travel planner.

Your job is to create a tasteful, realistic itinerary using only the provided legal candidate places.

You must:
- use only the provided placeId values
- include every must_visit place exactly once unless it is truly impossible because of opening_summary constraints
- minimize unnecessary backtracking
- keep the itinerary realistic for an actual trip
- follow the output JSON schema exactly`;
}

function buildRouteOptimizationBlock() {
  return `Route quality is a top priority.

Minimize unnecessary backtracking across the city.
Prefer grouping nearby places into the same day.
Do not bounce between distant areas unless a must-visit place or opening constraint makes it necessary.
When two valid options are similar, choose the one that keeps the route tighter and more coherent.

Use coord, cluster_hint, and distance_from_stay_m as routing hints.
A beautiful route is better than a scattered route.`;
}

function buildPlanningRulesBlock() {
  return `Hard rules:
- Every non-empty day must include exactly one LUNCH and exactly one DINNER.
- MORNING is optional and should only be used when there are suitable brunch, cafe, snack, or clearly morning-friendly places.
- Respect opening_summary for the actual trip dates when it is provided.
- If opening_summary is null for a place, opening hours are unknown rather than confirmed closed.
- Do not create impossible movement, duplicate conflicting times, or invalid JSON structure.
- If a must-visit cannot be legally scheduled, do not silently drop it. Put it in unschedulable_must_visits.

Mode-specific behavior:
- If planning_mode is OPTIMIZE_ALL:
  - include as many user-selected places as legally possible
  - prioritize grouping, sequencing, and routing over aggressive place dropping
  - treat day_budget_minutes as a soft target, not a reason to exclude places
- If planning_mode is RECOMMEND:
  - you may leave out some non-must-visit places if that creates a more coherent and realistic trip
  - prioritize stronger daily flow, better routing, and better pacing

Soft priorities:
- Build days that feel like real travel days: meals plus visits, shopping, activity, dessert, or nightlife when available.
- If the list is sparse, create the best realistic legal itinerary possible instead of forcing every day to be full.
- Do not leave a day empty if a coherent legal day can be formed.
- Respect day_budget_minutes as a soft cap.
- Use pace, companions, and themes as guidance, not rigid quotas.`;
}

function buildCopyRulesBlock() {
  return `For each stop:
- Write reason in English.
- Write visitTip in natural Korean with polite "~요" endings.
- visitTip must be genuinely useful, concise, and practical.
- In v1, visitTip should focus on:
  - reservation may be needed
  - waiting may be long
  - going slightly earlier or later may help
- If there is no genuinely useful tip, return null.
- Do not invent uncertain facts such as Korean menu availability.
- Do not write generic praise.`;
}

function buildOutputSchemaBlock() {
  return `Return JSON only.

Schema:
{
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "stops": [
        {
          "placeId": "provided placeId",
          "label": "MORNING | LUNCH | VISIT | DESSERT | DINNER | NIGHT",
          "time": "HH:MM",
          "reason": "English sentence or null",
          "visitTip": "Korean polite sentence or null"
        }
      ]
    }
  ],
  "unschedulable_must_visits": [
    {
      "placeId": "provided placeId",
      "reason": "short English reason"
    }
  ]
}`;
}

function buildPlannerPrompt(payload) {
  const blocks = [
    "[Route Optimization Block]",
    buildRouteOptimizationBlock(),
    "",
    "[Planning Rules Block]",
    buildPlanningRulesBlock(),
    "",
    "[Copy Rules Block]",
    buildCopyRulesBlock(),
    "",
    "[Output Schema Block]",
    buildOutputSchemaBlock(),
    "",
    "[Planning Input JSON]",
    JSON.stringify(payload, null, 2)
  ];

  return blocks.join("\n");
}

async function callGemini(systemPrompt, userPrompt) {
  const apiKey = ensureGeminiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelCandidates = getGeminiModelCandidates();
  let lastError = null;

  for (const modelName of modelCandidates) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" }
    });

    try {
      const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
      const response = await result.response;
      const text = response.text();
      const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(jsonString);
    } catch (error) {
      lastError = error;
      const status = Number(error?.status);
      const message = String(error?.message || "");
      const canTryNextModel =
        status === 400 ||
        status === 404 ||
        /no longer available|not found|not supported|does not exist/i.test(message);

      if (!canTryNextModel) {
        break;
      }
    }
  }

  throw lastError || new Error("Gemini API Error: no model candidate succeeded.");
}

function buildOpenAIHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
}

function extractOpenAITextContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (typeof entry?.text === "string") return entry.text;
      return "";
    })
    .join("")
    .trim();
}

async function callOpenAI(systemPrompt, userPrompt) {
  const apiKey = ensureOpenAIKey();
  const modelCandidates = getOpenAIModelCandidates();
  const headers = buildOpenAIHeaders(apiKey);
  let lastError = null;

  for (const modelName of modelCandidates) {
    try {
      const response = await axios.post(
        OPENAI_CHAT_COMPLETIONS_URL,
        {
          model: modelName,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `${systemPrompt}\n\nReturn valid JSON only.`
            },
            {
              role: "user",
              content: userPrompt
            }
          ]
        },
        {
          headers,
          timeout: 120000
        }
      );

      const text = extractOpenAITextContent(response?.data?.choices?.[0]?.message?.content);
      const jsonString = String(text || "").replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(jsonString);
    } catch (error) {
      lastError = error;
      const status = Number(error?.response?.status || error?.status);
      const message = String(error?.response?.data?.error?.message || error?.message || "");
      const canTryNextModel =
        status === 400 ||
        status === 404 ||
        /model|not found|unsupported|does not exist|response_format|json/i.test(message);

      if (!canTryNextModel) {
        break;
      }
    }
  }

  throw lastError || new Error("OpenAI API Error: no model candidate succeeded.");
}

async function callStructuredPlanner(systemPrompt, userPrompt) {
  const provider = resolveAiProvider();
  if (provider === "openai") {
    return callOpenAI(systemPrompt, userPrompt);
  }
  return callGemini(systemPrompt, userPrompt);
}

function getTripDayByDayNumber(generationInput = {}, dayNumber) {
  const tripDays = Array.isArray(generationInput.tripDays) ? generationInput.tripDays : [];
  return tripDays.find((tripDay) => Number(tripDay.day) === Number(dayNumber)) || null;
}

function normalizeGeneratedStopLabel(label, index, totalStops) {
  const normalized = String(label || "")
    .trim()
    .toUpperCase();

  const supportedLabels = new Set([...ROUTE_STOP_LABEL_VALUES]);
  if (supportedLabels.has(normalized)) {
    return normalized;
  }

  if (normalized === "START" || normalized === "FINISH") {
    return buildCanonicalRouteStopLabel(index, totalStops);
  }

  if (normalized === "BREAKFAST" || normalized === "BRUNCH") {
    return "MORNING";
  }

  if (normalized === "SUPPER") {
    return "DINNER";
  }

  if (normalized === "CAFE" || normalized === "SNACK") {
    return "DESSERT";
  }

  if (normalized === "BAR" || normalized === "PUB" || normalized === "NIGHTLIFE" || normalized === "LATE_NIGHT") {
    return "NIGHT";
  }

  return buildCanonicalRouteStopLabel(index, totalStops) || ROUTE_STOP_LABEL_FALLBACK;
}

function normalizeAiText(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function collectPlanDayIssues(dayBucket) {
  const issues = [];
  const seenTimes = new Set();
  let lunchCount = 0;
  let dinnerCount = 0;

  for (const stop of dayBucket?.stops || []) {
    const time = typeof stop?.time === "string" ? stop.time.slice(0, 5) : null;
    if (time) {
      if (seenTimes.has(time)) {
        issues.push(`duplicate_time:${time}`);
      }
      seenTimes.add(time);
    }

    if (stop?.label === "LUNCH") {
      lunchCount += 1;
    }

    if (stop?.label === "DINNER") {
      dinnerCount += 1;
    }
  }

  if ((dayBucket?.stops || []).length > 0 && lunchCount !== 1) {
    issues.push(`lunch_count:${lunchCount}`);
  }

  if ((dayBucket?.stops || []).length > 0 && dinnerCount !== 1) {
    issues.push(`dinner_count:${dinnerCount}`);
  }

  return issues;
}

function assertAiPlanLooksCoherent(planDays) {
  const issues = (planDays || []).flatMap((dayBucket) =>
    collectPlanDayIssues(dayBucket).map((issue) => `day ${dayBucket?.dayNumber || "?"}:${issue}`)
  );

  if (issues.length > 0) {
    throw new Error(`AI planner returned structurally invalid days (${issues.join(", ")})`);
  }
}

function normalizeCopiedStop(sanitizedStop) {
  const { corrected, place, ...persistedStop } = sanitizedStop;
  if (corrected) {
    return {
      ...persistedStop,
      reason: null,
      visitTip: null
    };
  }

  return persistedStop;
}

async function buildAiSchedulePlan({ candidates, dayCount, startDate, stayPlace, generationInput }) {
  const schedulableCandidates = filterNonLodgingCandidates(candidates);
  const planningPayload = buildPlannerPayload({
    candidates: schedulableCandidates,
    generationInput: {
      ...generationInput,
      planningMode: inferPlanningMode(schedulableCandidates, generationInput)
    },
    stayPlace
  });
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildPlannerPrompt(planningPayload);
  const response = await callStructuredPlanner(systemPrompt, userPrompt);

  if (!response || !Array.isArray(response.days)) {
    throw new Error(`Failed to generate itinerary from ${resolveAiProvider()} API`);
  }

  const candidateById = new Map(
    (schedulableCandidates || [])
      .map((candidate) => [candidate?.place?.id, candidate])
      .filter(([placeId]) => Boolean(placeId))
  );

  const planDays = Array.from({ length: dayCount }, (_, index) => ({
    dayNumber: index + 1,
    stops: []
  }));
  const usedPlaceIds = new Set();

  for (const dayPlan of response.days) {
    const dayNumber = Number(dayPlan?.day);
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > dayCount) continue;

    const tripDay = getTripDayByDayNumber(generationInput, dayNumber);
    const rawStops = [];
    const labelOccurrenceCounter = new Map();
    const stops = Array.isArray(dayPlan?.stops) ? dayPlan.stops : [];

    for (let stopIndex = 0; stopIndex < stops.length; stopIndex += 1) {
      const stop = stops[stopIndex];
      const placeId = String(stop?.placeId || "").trim();
      if (!placeId || usedPlaceIds.has(placeId)) continue;

      const matchedCandidate = candidateById.get(placeId);
      if (!matchedCandidate) continue;

      const normalizedLabel = normalizeGeneratedStopLabel(stop?.label, stopIndex, stops.length);
      const occurrenceIndex = labelOccurrenceCounter.get(normalizedLabel) || 0;
      labelOccurrenceCounter.set(normalizedLabel, occurrenceIndex + 1);
      const fallbackTime = minutesToTimeString(resolveLabelAnchorMinutes(normalizedLabel, generationInput.pace, occurrenceIndex));
      const resolvedTime =
        stop?.time && Number.isFinite(parseTimeToMinutes(stop.time)) ? String(stop.time).slice(0, 5) : fallbackTime;
      const availability = evaluateCandidateVisitWindow({
        candidate: matchedCandidate,
        visitDate: tripDay?.date || null,
        arrivalMinutes: parseTimeToMinutes(resolvedTime),
        label: normalizedLabel
      });
      if (availability.isKnown && !availability.isSlotValid) {
        continue;
      }

      rawStops.push({
        placeId,
        time: resolvedTime,
        label: normalizedLabel,
        isMustVisit: Boolean(matchedCandidate.isMustVisit),
        note: matchedCandidate.note || null,
        reason: normalizeAiText(stop?.reason),
        visitTip: normalizeAiText(stop?.visitTip),
        transportToNext: null
      });
      usedPlaceIds.add(placeId);
    }

    const sanitizedStops = sanitizeScheduledDayStops({
      stops: rawStops.map((stop) => ({
        ...stop,
        place: candidateById.get(stop.placeId)?.place || null
      })),
      visitDate: tripDay?.date || null,
      outputLanguage: generationInput.outputLanguage
    }).map(normalizeCopiedStop);

    planDays[dayNumber - 1].stops = normalizeStopOrder(sanitizedStops);
  }

  const missingMustVisitIds = schedulableCandidates
    .filter((candidate) => candidate.isMustVisit && candidate.place?.id && !usedPlaceIds.has(candidate.place.id))
    .map((candidate) => candidate.place.id);

  if (missingMustVisitIds.length > 0) {
    const fallbackPlanDays = buildSchedulePlan({
      candidates: schedulableCandidates,
      dayCount,
      stayPlace,
      generationInput
    });
    const fallbackByPlaceId = new Map();

    for (const fallbackDay of fallbackPlanDays) {
      for (const fallbackStop of fallbackDay.stops || []) {
        fallbackByPlaceId.set(fallbackStop.placeId, {
          dayNumber: fallbackDay.dayNumber,
          stop: fallbackStop
        });
      }
    }

    for (const placeId of missingMustVisitIds) {
      const fallbackEntry = fallbackByPlaceId.get(placeId);
      if (!fallbackEntry) continue;
      const targetDay = planDays[(Number(fallbackEntry.dayNumber) || 1) - 1];
      if (!targetDay) continue;

      targetDay.stops.push({
        ...fallbackEntry.stop,
        reason: null,
        visitTip: null
      });
    }

    for (const dayBucket of planDays) {
      dayBucket.stops = normalizeStopOrder(dayBucket.stops);
    }
  }

  const totalStops = planDays.reduce((count, dayBucket) => count + dayBucket.stops.length, 0);
  if (totalStops === 0) {
    throw new Error(`${resolveAiProvider()} returned no valid place IDs from the provided candidates.`);
  }

  assertAiPlanLooksCoherent(planDays);
  return planDays;
}

module.exports = {
  buildAiSchedulePlan,
  buildGeminiSchedulePlan: buildAiSchedulePlan
};
