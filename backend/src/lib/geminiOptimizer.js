const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  buildPromptDaySlotSummary,
  buildSchedulePlan,
  evaluateCandidateVisitWindow,
  filterNonLodgingCandidates,
  getCandidateTraits,
  resolveDailyStopTarget,
  resolveLabelAnchorMinutes,
  selectCandidatesForAiPlanning
} = require("./scheduleEngine");
const {
  ROUTE_STOP_LABEL_FALLBACK,
  ROUTE_STOP_LABEL_VALUES,
  buildCanonicalRouteStopLabel
} = require("./route-taxonomy");
const { sanitizeScheduledDayStops } = require("./scheduleStopSanitizer");

const DEFAULT_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];
const DEFAULT_OPENAI_MODELS = ["gpt-5-nano", "gpt-4.1-nano", "gpt-4o-mini", "gpt-4.1-mini"];
const DEFAULT_OUTPUT_LANGUAGE = "ko";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const SUPPORTED_AI_PROVIDERS = new Set(["gemini", "openai"]);
const AI_STAY_DISTANCE_OUTLIER_KM = 8;
const AI_DINNER_START_MINUTES = 16 * 60;

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

function resolveOutputLanguageName(outputLanguage) {
  return String(outputLanguage || DEFAULT_OUTPUT_LANGUAGE).toLowerCase() === "en" ? "English" : "Korean";
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || "";
}

function ensureGeminiKey() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  return apiKey;
}

function getGeminiModelCandidates() {
  const primaryModel = (process.env.GEMINI_MODEL || "").trim();
  const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const candidates = [primaryModel, ...fallbackModels, ...DEFAULT_GEMINI_MODELS].filter(Boolean);
  return [...new Set(candidates)];
}

function getOpenAIApiKey() {
  return process.env.OPENAI_API_KEY || "";
}

function ensureOpenAIKey() {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return apiKey;
}

function getOpenAIModelCandidates() {
  const primaryModel = (process.env.OPENAI_MODEL || "").trim();
  const fallbackModels = (process.env.OPENAI_FALLBACK_MODELS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const candidates = [primaryModel, ...fallbackModels, ...DEFAULT_OPENAI_MODELS].filter(Boolean);
  return [...new Set(candidates)];
}

function resolveAiProvider() {
  const requestedProvider = String(process.env.AI_PROVIDER || "")
    .trim()
    .toLowerCase();

  if (requestedProvider === "gpt" || requestedProvider === "chatgpt") {
    return "openai";
  }

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
  const sortedStops = [...(stops || [])]
    .map((stop, index) => ({ stop, index }))
    .sort((a, b) => {
      const timeDiff = parseTimeToMinutes(a.stop?.time) - parseTimeToMinutes(b.stop?.time);
      if (timeDiff !== 0) return timeDiff;
      return a.index - b.index;
    })
    .map((entry) => entry.stop);

  return sortedStops.map((stop, index) => ({
    ...stop,
    label: stop.label || buildCanonicalRouteStopLabel(index, sortedStops.length)
  }));
}

function collectPlanDayIssues(dayBucket) {
  const seenTimes = new Set();
  const duplicateTimes = new Set();
  let lunchCount = 0;
  let dinnerCount = 0;
  let nightCount = 0;
  let activityCount = 0;
  const issues = [];

  for (const stop of dayBucket?.stops || []) {
    const time = typeof stop?.time === "string" ? stop.time.slice(0, 5) : null;
    const timeMinutes = parseTimeToMinutes(time);
    const traits = stop?.place ? getCandidateTraits({ place: stop.place }) : null;

    if (time) {
      if (seenTimes.has(time)) {
        duplicateTimes.add(time);
      }
      seenTimes.add(time);
    }

    if (stop?.label === "LUNCH") {
      lunchCount += 1;
      if (Number.isFinite(timeMinutes) && timeMinutes >= AI_DINNER_START_MINUTES) {
        issues.push(`late_lunch:${time}`);
      }
    }

    if (stop?.label === "DINNER") {
      dinnerCount += 1;
      if (Number.isFinite(timeMinutes) && timeMinutes < AI_DINNER_START_MINUTES) {
        issues.push(`early_dinner:${time}`);
      }
    }

    if (stop?.label === "NIGHT") {
      nightCount += 1;
    }

    if (traits?.isActivity) {
      activityCount += 1;
    }
  }

  if (lunchCount > 1) {
    issues.push(`duplicate_lunch:${lunchCount}`);
  }

  if (dinnerCount > 1) {
    issues.push(`duplicate_dinner:${dinnerCount}`);
  }

  if ((dayBucket?.stops || []).length > 0 && lunchCount === 0) {
    issues.push("missing_lunch");
  }

  if ((dayBucket?.stops || []).length > 0 && dinnerCount === 0) {
    issues.push("missing_dinner");
  }

  if (nightCount > 2) {
    issues.push(`too_many_night:${nightCount}`);
  }

  if (activityCount > 1) {
    issues.push(`too_many_activity:${activityCount}`);
  }

  for (const time of duplicateTimes) {
    issues.push(`duplicate_time:${time}`);
  }

  return issues;
}

function assertAiPlanLooksCoherent(planDays) {
  const issueSummary = (planDays || []).flatMap((dayBucket) =>
    collectPlanDayIssues(dayBucket).map((issue) => `day ${dayBucket?.dayNumber || "?"}:${issue}`)
  );

  if (issueSummary.length === 0) {
    return;
  }

  throw new Error(`AI planner returned structurally invalid day slots (${issueSummary.join(", ")})`);
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

  if (normalized === "LUNCH") {
    return "LUNCH";
  }

  if (normalized === "AFTERNOON") {
    return "DESSERT";
  }

  if (normalized === "SUPPER") {
    return "DINNER";
  }

  if (
    normalized === "NIGHT" ||
    normalized === "BAR" ||
    normalized === "PUB" ||
    normalized === "CLUB" ||
    normalized === "NIGHT_VIEW" ||
    normalized === "NIGHTLIFE" ||
    normalized === "LATE_NIGHT"
  ) {
    return "NIGHT";
  }

  if (normalized === "CAFE" || normalized === "SNACK") {
    return "DESSERT";
  }

  return buildCanonicalRouteStopLabel(index, totalStops);
}

function buildFallbackStop(fallbackStop, matchedCandidate) {
  return {
    ...fallbackStop,
    isMustVisit: Boolean(fallbackStop?.isMustVisit || matchedCandidate?.isMustVisit),
    note: matchedCandidate?.note || fallbackStop?.note || null
  };
}

function redistributeSelectedStopsAcrossDays({ planDays, candidates, dayCount, stayPlace, generationInput }) {
  const selectedPlaceIds = new Set(
    (planDays || []).flatMap((day) => (day?.stops || []).map((stop) => stop?.placeId).filter(Boolean))
  );
  const selectedCandidates = (candidates || []).filter((candidate) => selectedPlaceIds.has(candidate?.place?.id));

  if (selectedCandidates.length === 0) {
    return planDays;
  }

  return buildSchedulePlan({
    candidates: selectedCandidates,
    dayCount,
    stayPlace,
    generationInput
  });
}

function backfillSparseDaysFromFallback({
  planDays,
  fallbackPlanDays,
  candidateById,
  usedPlaceIds,
  generationInput
}) {
  const minimumStopsPerDay = resolveDailyStopTarget(generationInput);
  const totalStopTarget = Math.min(candidateById.size, minimumStopsPerDay * planDays.length);
  const fallbackByDayNumber = new Map((fallbackPlanDays || []).map((day) => [Number(day.dayNumber), day]));
  const touchedDayNumbers = new Set();

  for (const dayBucket of planDays) {
    const fallbackDay = fallbackByDayNumber.get(Number(dayBucket?.dayNumber));
    if (!fallbackDay) continue;

    for (const fallbackStop of fallbackDay.stops || []) {
      const needsDayFill = dayBucket.stops.length < minimumStopsPerDay;
      const needsOverallFill = usedPlaceIds.size < totalStopTarget;
      if (!needsDayFill && !needsOverallFill) break;

      const placeId = String(fallbackStop?.placeId || "").trim();
      if (!placeId || usedPlaceIds.has(placeId)) continue;

      const matchedCandidate = candidateById.get(placeId);
      if (!matchedCandidate) continue;

      dayBucket.stops.push(buildFallbackStop(fallbackStop, matchedCandidate));
      usedPlaceIds.add(placeId);
      touchedDayNumbers.add(dayBucket.dayNumber);
    }
  }

  for (const dayNumber of touchedDayNumbers) {
    const dayBucket = planDays.find((day) => Number(day?.dayNumber) === Number(dayNumber));
    if (!dayBucket) continue;
    dayBucket.stops = normalizeStopOrder(dayBucket.stops);
  }

  return planDays;
}

function roundCoordinate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(3)) : null;
}

function buildPromptTags(candidate) {
  const traits = getCandidateTraits(candidate);
  const tags = new Set();

  if (traits.isLandmark) tags.add("landmark");
  if (traits.isNature) tags.add("nature");
  if (traits.isShopping) tags.add("shopping");
  if (traits.isActivity) tags.add("activity");
  if (traits.isMeal) tags.add("meal");
  if (traits.isBrunch) tags.add("brunch");
  if (traits.isCafe) tags.add("cafe");
  if (traits.isSnack) tags.add("snack");
  if (traits.isDinnerPreferred) tags.add("dinner_worthy");
  if (traits.isAnchorMeal) tags.add("anchor_meal");
  if (traits.isAnchorVisit) tags.add("anchor_visit");
  if (traits.isNightlife) tags.add("nightlife");
  if (traits.isNightView) tags.add("night_view");
  if (traits.isNight) tags.add("night");
  if (traits.reservationRisk) tags.add("reservation_risk");

  return [...tags];
}

function buildPromptPlaceSummary(candidate, generationInput = {}, stayPlace = null) {
  const place = candidate.place;
  const traits = getCandidateTraits(candidate);
  const daySlots = buildPromptDaySlotSummary(candidate, generationInput.tripDays, generationInput.pace);
  const stayDistanceKm = stayPlace
    ? haversineKm(stayPlace.lat, stayPlace.lng, place.lat, place.lng)
    : null;

  const summary = {
    id: place.id,
    name: place.name,
    category: place.category || null,
    types: Array.isArray(place.types_raw) ? place.types_raw.slice(0, 8) : [],
    coord: [roundCoordinate(place.lat), roundCoordinate(place.lng)],
    tags: buildPromptTags(candidate),
    price_level: traits.priceLevel,
    rating: traits.rating,
    review_count: traits.reviewCount,
    fame_score: Number(traits.fameScore.toFixed(3)),
    meal_fit: traits.mealFit,
    night_subtype: traits.nightSubtype,
    anchor_candidate: Boolean(traits.isAnchorMeal || traits.isAnchorVisit),
    must_visit: Boolean(candidate.isMustVisit),
    user_note: candidate.note || null,
    reservation_risk: traits.reservationRisk
  };

  if (daySlots) {
    summary.day_slots = daySlots;
  }

  if (stayDistanceKm != null) {
    summary.distance_from_stay_km = Number(stayDistanceKm.toFixed(2));
    summary.far_from_stay = stayDistanceKm >= AI_STAY_DISTANCE_OUTLIER_KM;
  }

  return summary;
}

function getTripDayByDayNumber(generationInput = {}, dayNumber) {
  const tripDays = Array.isArray(generationInput.tripDays) ? generationInput.tripDays : [];
  return tripDays.find((day) => Number(day.day) === Number(dayNumber)) || null;
}

function resolvePlannedMinutesFromActivity({ activity, label, generationInput = {}, occurrenceIndex = 0 }) {
  const parsedTime = parseTimeToMinutes(activity?.time);
  if (Number.isFinite(parsedTime)) {
    return parsedTime;
  }

  return resolveLabelAnchorMinutes(label, generationInput.pace, occurrenceIndex);
}

function isValidAiActivityForOpeningHours({ candidate, tripDay, activity, label, generationInput = {}, occurrenceIndex = 0 }) {
  const visitDate = tripDay?.date || null;
  const plannedMinutes = resolvePlannedMinutesFromActivity({
    activity,
    label,
    generationInput,
    occurrenceIndex
  });

  const availability = evaluateCandidateVisitWindow({
    candidate,
    visitDate,
    arrivalMinutes: plannedMinutes,
    label
  });

  return {
    plannedMinutes,
    availability,
    isValid: !availability.isKnown || availability.isSlotValid
  };
}

function generatePrompt(places, scenario, generationInput, stayPlace = null) {
  const isPersonalized = scenario === 'Personalized';
  const targetCity = generationInput.city || "Unknown";
  const outputLanguage = resolveOutputLanguageName(generationInput.outputLanguage);
  const dailyStopTarget = resolveDailyStopTarget(generationInput);
  const tripDays = Array.isArray(generationInput.tripDays) ? generationInput.tripDays : [];
  const tripDaySummary =
    tripDays.length > 0
      ? tripDays.map((day) => `  - Day ${day.day}: ${day.date} (${day.weekdayEn}, ${day.weekdayKo})`).join("\n")
      : "  - Day 1: use the provided start/end date context";
  
  let prompt = `
You are an expert travel planner.
Context:
- Dates: ${generationInput.startDate} to ${generationInput.endDate}
- Target City: ${targetCity}
- Output Language: ${outputLanguage}
- Trip Days:
${tripDaySummary}

User Preferences (${scenario}):
`;

  if (isPersonalized) {
      prompt += `
- Companions: ${generationInput.companions || 'Any'}
- Pace: ${generationInput.pace || 'Moderate'}
- Themes: ${(generationInput.themes || []).join(", ") || 'Any'}
- Goal: Build the most coherent trip from the provided list first. If the list is too large to fit realistically, use pace and themes only as tie-breakers for which places to keep.
- Prioritize specifically: Every place with "must_visit": true must be included exactly once, but do not invent new must-visit places on your own. User notes should influence placement.
`;
      if (stayPlace && Number.isFinite(Number(stayPlace.lat)) && Number.isFinite(Number(stayPlace.lng))) {
        prompt += `
- Lodging Base: A booked stay exists at approximately [${Number(stayPlace.lat).toFixed(5)}, ${Number(stayPlace.lng).toFixed(5)}].
- When several places are far from the stay, group them into the same day instead of bouncing back and forth across the city.
- Prefer places with lower "distance_from_stay_km" unless a farther cluster is strong enough to justify a dedicated day.
`;
      }
  } else {
      prompt += `
- Goal: Create a logical, distance-minimized route focusing on standard popular places.
`;
  }

  prompt += `
Available Places (JSON):
${JSON.stringify(places)}

Field notes:
- "day_slots" is optional. Each entry looks like "1:MLVCDN" where M=morning, L=lunch, V=visit, C=dessert/cafe, D=dinner, N=night, and "-" means do not schedule that place on that trip day.
- Treat place "tags" as hard hints for labels. A place tagged "meal" should be LUNCH or DINNER. "brunch", "cafe", and "snack" should usually be MORNING or DESSERT. "landmark", "nature", "shopping", and "activity" should usually be MORNING or VISIT.
- "category" is already backend-normalized for scheduling. Trust it first. "types" are supporting raw Google hints.
- "night_subtype" explains whether a NIGHT place is more like a bar, club, live venue, or night view. Use it to build a realistic evening sequence.
- "meal_fit", "fame_score", and "anchor_candidate" show which meal or visit places are stronger anchors.

Task:
Generate a valid JSON object with the following structure:
{
  "itinerary": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "activities": [
        {
          "place_id": "ID from the provided list",
          "time": "HH:MM",
          "label": "${[...ROUTE_STOP_LABEL_VALUES].join(" | ")}",
          "reason": "Short reason why selected here",
          "visitTip": "Short, actionable on-site tip in the output language, or null if there is nothing useful to say"
        }
      ]
    }
  ]
}

Rules:
1. Group places geographically to minimize travel time.
2. Every place with "must_visit": true must appear exactly once in the itinerary.
3. If a place has a "user_note", use it to influence timing and placement.
4. Make sure "place_id" matches exactly the ID from the provided list.
5. Use only places located in "${targetCity}".
6. Write both "reason" and "visitTip" in ${outputLanguage}.
7. If a place includes "day_slots", only schedule it on allowed trip days and slot windows.
8. Use every trip day only when there are enough places for a coherent day. If there are not enough places, it is acceptable to leave later days empty.
9. Every non-empty day must include exactly one LUNCH and exactly one DINNER.
10. If themes include FOODIE and brunch/cafe/snack candidates are available, include a MORNING stop on that day.
11. For RELAXED pace, starting around 11:00 or 12:00 is allowed.
12. Use NIGHT only for real night places after dinner. A day may have up to two NIGHT stops when they are close together and logically sequenced.
13. When choosing LUNCH or DINNER, prefer places with higher "fame_score", stronger meal types, and higher review counts over tiny low-signal places.
14. If "reservation_risk" is true, mention that reservations may be worth checking in "visitTip".
15. "visitTip" must be practical and concise, not generic praise.
16. If the output language is Korean, write in natural spoken Korean with polite "~요" endings and avoid stiff phrasing like "~합니다".
17. Do not schedule hotels, lodging, or accommodations as itinerary stops.
18. Never label a non-dessert venue as DESSERT. Seafood restaurants, general restaurants, landmarks, markets, parks, museums, and shopping places must not be labeled DESSERT.
19. If the candidate list does not contain a real dessert/cafe/bakery place for that day, skip DESSERT entirely instead of inventing one.
20. Landmarks, tourist attractions, parks, museums, natural spots, and shops should normally use MORNING or VISIT, not DESSERT.
20a. ACTIVITY places such as karting, arcades, or bowling should use MORNING or VISIT, and use at most one ACTIVITY place per day.
21. MEAL places must never be labeled VISIT. If they do not fit as LUNCH or DINNER, leave them out.
22. BRUNCH, CAFE, and SNACK places should generally use MORNING or DESSERT, not VISIT.
23. If non-food themes such as LANDMARK, NATURE, or SHOPPING are selected and there are enough matching anchors, use those as the main daytime anchors and place meals around them.
24. If those non-food theme anchors are too scarce to support the trip, fall back to a more general route instead of forcing bad anchors.
25. Must-visit places are higher priority than theme preference. Keep every must-visit exactly once unless it is impossible because of opening constraints.
26. Do not schedule more than three restaurant-style meal stops in the same day, including morning brunch restaurants.
27. Within each day, activity times must be strictly increasing. Do not assign the same time to multiple stops.
28. Keep realistic spacing between stops. Do not stack two meal venues into the same time slot.
29. Return JSON only. No markdown, no code fences, no explanations.
`;
  return prompt;
}

async function callGemini(prompt) {
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
      console.log(`Sending request to Gemini with model: ${modelName}`);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (result.response.usageMetadata) {
        console.log(
          `Token Usage - Prompt: ${result.response.usageMetadata.promptTokenCount}, Candidates: ${result.response.usageMetadata.candidatesTokenCount}`
        );
      }

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

      console.error(`Gemini API Error with model ${modelName}:`, error);

      if (!canTryNextModel) {
        break;
      }
    }
  }

  throw lastError || new Error("Gemini API Error: no model candidate succeeded.");
}

function buildOpenAIHeaders(apiKey) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };

  const organization = String(process.env.OPENAI_ORGANIZATION || "").trim();
  if (organization) {
    headers["OpenAI-Organization"] = organization;
  }

  const project = String(process.env.OPENAI_PROJECT || "").trim();
  if (project) {
    headers["OpenAI-Project"] = project;
  }

  return headers;
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

async function callOpenAI(prompt) {
  const apiKey = ensureOpenAIKey();
  const modelCandidates = getOpenAIModelCandidates();
  const headers = buildOpenAIHeaders(apiKey);
  let lastError = null;

  for (const modelName of modelCandidates) {
    try {
      console.log(`Sending request to OpenAI with model: ${modelName}`);

      const response = await axios.post(
        OPENAI_CHAT_COMPLETIONS_URL,
        {
          model: modelName,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are a travel itinerary API. Return valid JSON only. Do not wrap the response in markdown or code fences."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        },
        {
          headers,
          timeout: 120000
        }
      );

      const usage = response?.data?.usage;
      if (usage) {
        console.log(
          `Token Usage - Provider: OpenAI, Prompt: ${usage.prompt_tokens || 0}, Completion: ${usage.completion_tokens || 0}, Total: ${usage.total_tokens || 0}`
        );
      }

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

      console.error(`OpenAI API Error with model ${modelName}:`, message || error);

      if (!canTryNextModel) {
        break;
      }
    }
  }

  throw lastError || new Error("OpenAI API Error: no model candidate succeeded.");
}

async function callStructuredPlanner(prompt) {
  const provider = resolveAiProvider();
  if (provider === "openai") {
    return callOpenAI(prompt);
  }
  return callGemini(prompt);
}

async function buildAiSchedulePlan({ candidates, dayCount, startDate, stayPlace, generationInput, scenario = 'Personalized' }) {
    const schedulableCandidates = filterNonLodgingCandidates(candidates);
    // 1. Format candidates into the structure expected by the prompt
    const aiCandidates = selectCandidatesForAiPlanning(schedulableCandidates, dayCount, generationInput);
    if (aiCandidates.length !== schedulableCandidates.length) {
      console.log("Reducing AI candidate payload for faster planning.", {
        originalCount: schedulableCandidates.length,
        aiCount: aiCandidates.length,
        dayCount,
        pace: generationInput?.pace || null
      });
    }

    const placesList = aiCandidates.map((candidate) => buildPromptPlaceSummary(candidate, generationInput, stayPlace));

    const prompt = generatePrompt(placesList, scenario, generationInput, stayPlace);
    
    const itineraryResponse = await callStructuredPlanner(prompt);
    
    if (!itineraryResponse || !itineraryResponse.itinerary) {
        throw new Error(`Failed to generate itinerary from ${resolveAiProvider()} API`);
    }

    const candidateById = new Map(
      (schedulableCandidates || [])
        .map((candidate) => [candidate?.place?.id, candidate])
        .filter(([placeId]) => Boolean(placeId))
    );

    let planDays = Array.from({ length: dayCount }).map((_, index) => ({
      dayNumber: index + 1,
      stops: []
    }));

    const usedPlaceIds = new Set();
    const itineraryDays = Array.isArray(itineraryResponse.itinerary) ? itineraryResponse.itinerary : [];

    for (const dayPlan of itineraryDays) {
      const dayNumber = Number(dayPlan?.day);
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > dayCount) continue;

      const dayBucket = planDays[dayNumber - 1];
      const tripDay = getTripDayByDayNumber(generationInput, dayNumber);
      const activities = Array.isArray(dayPlan?.activities) ? dayPlan.activities : [];
      const labelOccurrenceCounter = new Map();
      const rawStops = [];

      for (let activityIndex = 0; activityIndex < activities.length; activityIndex += 1) {
        const activity = activities[activityIndex];
        const placeId = String(activity?.place_id || "").trim();
        if (!placeId || usedPlaceIds.has(placeId)) continue;

        const matchedCandidate = candidateById.get(placeId);
        if (!matchedCandidate) continue;

        const normalizedLabel =
          normalizeGeneratedStopLabel(activity?.label, activityIndex, activities.length) || ROUTE_STOP_LABEL_FALLBACK;
        const occurrenceIndex = labelOccurrenceCounter.get(normalizedLabel) || 0;
        labelOccurrenceCounter.set(normalizedLabel, occurrenceIndex + 1);
        const availabilityCheck = isValidAiActivityForOpeningHours({
          candidate: matchedCandidate,
          tripDay,
          activity,
          label: normalizedLabel,
          generationInput,
          occurrenceIndex
        });
        if (!availabilityCheck.isValid) {
          console.warn("AI planner scheduled a place outside opening hours. Dropping it before save.", {
            dayNumber,
            placeId,
            label: normalizedLabel,
            time: activity?.time || null,
            status: availabilityCheck.availability?.status || "unknown"
          });
          continue;
        }

        rawStops.push({
          placeId,
          time:
            activity?.time && Number.isFinite(parseTimeToMinutes(activity.time))
              ? activity.time
              : minutesToTimeString(availabilityCheck.plannedMinutes),
          label: normalizedLabel,
          isMustVisit: Boolean(matchedCandidate.isMustVisit),
          note: matchedCandidate.note || null,
          reason: activity?.reason || null,
          visitTip: activity?.visitTip || null,
          transportToNext: null
        });
        usedPlaceIds.add(placeId);
      }

      const rawStopByPlaceId = new Map(rawStops.map((stop) => [stop.placeId, stop]));

      const sanitizedStops = sanitizeScheduledDayStops({
        stops: rawStops.map((stop) => ({
          ...stop,
          place: candidateById.get(stop.placeId)?.place || null
        })),
        visitDate: tripDay?.date || null,
        outputLanguage: generationInput.outputLanguage
      });
      const keptPlaceIds = new Set(sanitizedStops.map((stop) => stop.placeId));
      for (const rawStop of rawStops) {
        if (!keptPlaceIds.has(rawStop.placeId)) {
          usedPlaceIds.delete(rawStop.placeId);
        }
      }

      dayBucket.stops = sanitizedStops.map((sanitizedStop) => {
        const originalStop = rawStopByPlaceId.get(sanitizedStop.placeId) || null;

        if (sanitizedStop.corrected) {
          console.warn("Adjusted incompatible AI stop label before save.", {
            dayNumber,
            placeId: sanitizedStop.placeId,
            from: originalStop?.label || null,
            to: sanitizedStop.label,
            time: sanitizedStop.time || null
          });
        }

        const { corrected, place, ...persistedStop } = sanitizedStop;
        return persistedStop;
      });
    }

    const missingPriorityPlaceIds = (schedulableCandidates || [])
      .filter((candidate) => Boolean(candidate?.isMustVisit && candidate?.place?.id && !usedPlaceIds.has(candidate.place.id)))
      .map((candidate) => candidate.place.id);

    if (missingPriorityPlaceIds.length > 0) {
      console.warn("AI planner omitted must-visit places. Backfilling them with deterministic planner.", {
        missingPriorityPlaceIds
      });

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

      const touchedDayNumbers = new Set();

      for (const placeId of missingPriorityPlaceIds) {
        const fallbackEntry = fallbackByPlaceId.get(placeId);
        const matchedCandidate = candidateById.get(placeId);
        if (!fallbackEntry || !matchedCandidate) continue;

        const targetDayNumber = Number(fallbackEntry.dayNumber) || 1;
        const dayBucket = planDays[targetDayNumber - 1] || planDays[0];
        if (!dayBucket) continue;

        dayBucket.stops.push({
          ...fallbackEntry.stop,
          isMustVisit: Boolean(fallbackEntry.stop?.isMustVisit || matchedCandidate.isMustVisit),
          note: matchedCandidate.note || fallbackEntry.stop?.note || null,
          transportToNext: null
        });
        usedPlaceIds.add(placeId);
        touchedDayNumbers.add(targetDayNumber);
      }

      for (const dayNumber of touchedDayNumbers) {
        const dayBucket = planDays[dayNumber - 1];
        if (!dayBucket) continue;
        dayBucket.stops = normalizeStopOrder(dayBucket.stops);
      }
    }

    let totalStops = planDays.reduce((count, day) => count + day.stops.length, 0);
    if (totalStops === 0) {
      throw new Error(`${resolveAiProvider()} returned no valid place IDs from the provided city-filtered candidates.`);
    }

    assertAiPlanLooksCoherent(planDays);

    return planDays;
}

module.exports = {
  buildAiSchedulePlan,
  buildGeminiSchedulePlan: buildAiSchedulePlan
};
