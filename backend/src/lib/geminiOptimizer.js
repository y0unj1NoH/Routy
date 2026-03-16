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
  MUST_VISIT_BADGE,
  ROUTE_STOP_LABEL_FALLBACK,
  ROUTE_STOP_LABEL_VALUES,
  appendMustVisitBadge,
  buildCanonicalRouteStopLabel
} = require("./route-taxonomy");

const DEFAULT_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];
const DEFAULT_OPENAI_MODELS = ["gpt-5-nano", "gpt-4.1-nano", "gpt-4o-mini", "gpt-4.1-mini"];
const DEFAULT_OUTPUT_LANGUAGE = "ko";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const SUPPORTED_AI_PROVIDERS = new Set(["gemini", "openai"]);

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
    label: buildCanonicalRouteStopLabel(index, sortedStops.length)
  }));
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
    badges: appendMustVisitBadge(fallbackStop?.badges, matchedCandidate?.priority),
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
  if (traits.isShopping) tags.add("shopping");
  if (traits.isMeal) tags.add("meal");
  if (traits.isDessert) tags.add("dessert");
  if (traits.isDinnerPreferred) tags.add("dinner_worthy");
  if (traits.isNightlife) tags.add("nightlife");
  if (traits.isNightView) tags.add("night_view");
  if (traits.isNight) tags.add("night");
  if (traits.reservationRisk) tags.add("reservation_risk");

  return [...tags];
}

function buildPromptPlaceSummary(candidate, generationInput = {}) {
  const place = candidate.place;
  const traits = getCandidateTraits(candidate);
  const daySlots = buildPromptDaySlotSummary(candidate, generationInput.tripDays, generationInput.pace);

  const summary = {
    id: place.id,
    name: place.name,
    coord: [roundCoordinate(place.lat), roundCoordinate(place.lng)],
    tags: buildPromptTags(candidate),
    price_level: traits.priceLevel,
    rating: traits.rating,
    must_visit: Boolean(candidate.priority),
    user_note: candidate.note || null,
    reservation_risk: traits.reservationRisk
  };

  if (daySlots) {
    summary.day_slots = daySlots;
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

function generatePrompt(places, scenario, generationInput) {
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
8. Use every trip day when there are enough candidates. Aim for about ${dailyStopTarget} major stops per day.
9. Include LUNCH and DINNER every day when meal candidates are available.
10. If companions are COUPLE and dessert candidates are available, include at least one DESSERT per day.
11. For RELAXED pace, starting around 11:00 or 12:00 is allowed.
12. Use NIGHT for bars, pubs, clubs, late-night spots, or night views after dinner. NIGHT can be nightlife or a night-view stop.
13. When choosing DINNER, prefer stronger meal types and higher price_level over lighter cafe-style places.
14. If "reservation_risk" is true, mention that reservations may be worth checking in "visitTip".
15. "visitTip" must be practical and concise, not generic praise.
16. If the output language is Korean, write in natural spoken Korean with polite "~요" endings and avoid stiff phrasing like "~합니다".
17. Do not schedule hotels, lodging, or accommodations as itinerary stops.
18. Return JSON only. No markdown, no code fences, no explanations.
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

    const placesList = aiCandidates.map((candidate) => buildPromptPlaceSummary(candidate, generationInput));

    const prompt = generatePrompt(placesList, scenario, generationInput);
    
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

        const badges = [];
        if (matchedCandidate.priority) badges.push(MUST_VISIT_BADGE);

        dayBucket.stops.push({
          placeId,
          time:
            activity?.time && Number.isFinite(parseTimeToMinutes(activity.time))
              ? activity.time
              : minutesToTimeString(availabilityCheck.plannedMinutes),
          label: normalizedLabel,
          badges,
          note: matchedCandidate.note || null,
          reason: activity?.reason || null,
          visitTip: activity?.visitTip || null,
          transportToNext: null
        });
        usedPlaceIds.add(placeId);
      }
    }

    const missingPriorityPlaceIds = (schedulableCandidates || [])
      .filter((candidate) => Boolean(candidate?.priority && candidate?.place?.id && !usedPlaceIds.has(candidate.place.id)))
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
          badges: appendMustVisitBadge(fallbackEntry.stop?.badges, matchedCandidate.priority),
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
    const hasEmptyDay = planDays.some((day) => day.stops.length === 0);
    const minimumTotalStops = Math.min(candidateById.size, resolveDailyStopTarget(generationInput) * dayCount);

    if (hasEmptyDay && totalStops > 0) {
      planDays = redistributeSelectedStopsAcrossDays({
        planDays,
        candidates: schedulableCandidates,
        dayCount,
        stayPlace,
        generationInput
      });
      totalStops = planDays.reduce((count, day) => count + day.stops.length, 0);
    }

    if (totalStops > 0 && totalStops < minimumTotalStops) {
      const fallbackPlanDays = buildSchedulePlan({
        candidates: schedulableCandidates,
        dayCount,
        stayPlace,
        generationInput
      });

      backfillSparseDaysFromFallback({
        planDays,
        fallbackPlanDays,
        candidateById,
        usedPlaceIds,
        generationInput
      });
      totalStops = planDays.reduce((count, day) => count + day.stops.length, 0);
    }

    if (totalStops === 0) {
      throw new Error(`${resolveAiProvider()} returned no valid place IDs from the provided city-filtered candidates.`);
    }

    return planDays;
}

module.exports = {
  buildAiSchedulePlan,
  buildGeminiSchedulePlan: buildAiSchedulePlan
};
