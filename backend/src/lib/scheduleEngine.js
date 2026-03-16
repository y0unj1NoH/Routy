const {
  MUST_VISIT_BADGE,
  PLACE_CATEGORY,
  THEME_CATEGORY,
  appendMustVisitBadge,
  buildCanonicalRouteStopLabel
} = require("./route-taxonomy");

const MEAL_PATTERN =
  /restaurant|meal|ramen|sushi|yakitori|yakiniku|bbq|barbecue|grill|shabu|sukiyaki|hot_pot|steak|seafood|bistro|diner|tempura|udon|soba|katsu|burger|pizza|pasta|food_court|brunch/i;
const HEAVY_DINNER_PATTERN =
  /izakaya|yakitori|yakiniku|bbq|barbecue|grill|steak|omakase|sushi|seafood|shabu|sukiyaki|hot_pot|french_restaurant|italian_restaurant|korean_restaurant|wine_bar|bistro|fine_dining/i;
const DESSERT_PATTERN =
  /dessert|pastry|bakery|patisserie|confectionery|cafe|coffee|tea|juice_shop|ice_cream|gelato|macaron|cake|chocolate|donut|crepe/i;
const NIGHTLIFE_PATTERN =
  /bar|pub|wine_bar|cocktail|beer|night_club|club|karaoke|live_music|izakaya|speakeasy/i;
const NIGHT_VIEW_PATTERN = /observation|view|tower|lookout|skywalk|wheel|night_view|scenic/i;
const RESERVATION_RISK_PATTERN =
  /izakaya|wine_bar|omakase|sushi_restaurant|seafood_restaurant|french_restaurant|steak|yakitori|yakiniku|fine_dining|bistro/i;
const LODGING_PATTERN = /hotel|lodging|hostel|motel|guest|inn|resort|ryokan|accommodation/i;
const SHOPPING_PATTERN = /shopping|store|mall|market|department_store|drugstore|toy_store/i;
const LANDMARK_PATTERN = /tourist_attraction|museum|park|art_gallery|landmark|temple/i;
const MORNING_FRIENDLY_PATTERN = /park|museum|market|shopping|cafe|bakery|dessert|tourist_attraction/i;
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;
const SLOT_MINIMUM_WINDOW_MINUTES = {
  MORNING: 50,
  LUNCH: 60,
  VISIT: 55,
  DESSERT: 40,
  DINNER: 75,
  NIGHT: 60
};
const PROMPT_DAY_SLOT_CODES = {
  MORNING: "M",
  LUNCH: "L",
  VISIT: "V",
  DESSERT: "C",
  DINNER: "D",
  NIGHT: "N"
};

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.max(50, Math.round(distanceKm * 1000))}m`;
  return `${distanceKm.toFixed(1)}km`;
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return null;
  return `${Math.max(1, Math.round(minutes))}분`;
}

function formatDurationByLanguage(minutes, outputLanguage) {
  if (!Number.isFinite(minutes)) return null;
  const rounded = Math.max(1, Math.round(minutes));
  return outputLanguage === "en" ? `${rounded} min` : `${rounded}분`;
}

function minutesToTime(minutes) {
  const normalized = Math.max(0, Math.round(minutes));
  const hour = String(Math.floor(normalized / 60) % 24).padStart(2, "0");
  const minute = String(normalized % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function normalizeDayMinutes(minutes) {
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(numeric)));
}

function getWeekdayIndex(dateString) {
  if (typeof dateString !== "string" || !dateString) return null;
  const date = new Date(`${dateString}T00:00:00Z`);
  const weekdayIndex = date.getUTCDay();
  return Number.isFinite(weekdayIndex) ? weekdayIndex : null;
}

function getTransportSpeed(mode) {
  if (mode === "WALK") return 4.5;
  if (mode === "TRANSIT") return 20;
  return 28;
}

function estimateTransport(from, to) {
  if (!from || !to) return null;
  if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) return null;

  const distanceKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const mode = distanceKm <= 1.2 ? "WALK" : distanceKm <= 6 ? "TRANSIT" : "TAXI";
  const speed = getTransportSpeed(mode);
  const travelMinutes = Math.max(1, Math.round((distanceKm / speed) * 60));

  return {
    mode,
    distance: formatDistance(distanceKm),
    duration: formatDuration(travelMinutes),
    travelMinutes
  };
}

function orderCandidatesByNearestNeighbor(candidates, anchor) {
  if (!anchor || anchor.lat == null || anchor.lng == null) {
    return [...candidates];
  }

  const remaining = [...candidates];
  const ordered = [];
  let current = { lat: anchor.lat, lng: anchor.lng };

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const place = candidate.place;
      if (place.lat == null || place.lng == null) continue;

      const distance = haversineKm(current.lat, current.lng, place.lat, place.lng);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    if (next.place.lat != null && next.place.lng != null) {
      current = { lat: next.place.lat, lng: next.place.lng };
    }
  }

  return ordered;
}

function resolveDailyStopTarget(generationInput = {}) {
  const pace = String(generationInput.pace || "").toUpperCase();
  if (pace === "INTENSE") return 5;
  if (pace === "RELAXED") return 3;
  return 4;
}

function resolveTripStopLimit(dayCount, generationInput = {}) {
  return Math.max(1, resolveDailyStopTarget(generationInput) * Math.max(1, Number(dayCount) || 1));
}

function normalizeThemes(themes) {
  return new Set(
    (Array.isArray(themes) ? themes : [])
      .map((theme) => String(theme || "").trim().toUpperCase())
      .filter(Boolean)
  );
}

function normalizeCompanions(companions) {
  return String(companions || "")
    .trim()
    .toUpperCase();
}

function isCoupleTrip(generationInput = {}) {
  return normalizeCompanions(generationInput.companions) === "COUPLE";
}

function isGroupTrip(generationInput = {}) {
  const companions = normalizeCompanions(generationInput.companions);
  return companions === "GROUP" || companions === "FRIENDS";
}

function isFamilyTrip(generationInput = {}) {
  return normalizeCompanions(generationInput.companions) === "FAMILY";
}

function isFoodieTrip(generationInput = {}) {
  return normalizeThemes(generationInput.themes).has(THEME_CATEGORY.FOODIE);
}

function inferLandmark(place) {
  if (typeof place.category === "string" && place.category.toUpperCase().includes(PLACE_CATEGORY.LANDMARK)) {
    return true;
  }

  const types = Array.isArray(place.types_raw) ? place.types_raw : [];
  return types.some((type) => LANDMARK_PATTERN.test(String(type)));
}

function isViewSpot(candidate) {
  const category = String(candidate?.place?.category || "").toUpperCase();
  if (category.includes(PLACE_CATEGORY.VIEW)) return true;
  const types = Array.isArray(candidate?.place?.types_raw) ? candidate.place.types_raw : [];
  return types.some((type) => /observation|view|tower|lookout|skywalk|wheel|observatory|scenic/i.test(String(type)));
}

function getCandidatePriceLevel(candidate) {
  const value = candidate?.place?.price_level ?? candidate?.place?.priceLevel;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function getCandidateOpeningHours(candidate) {
  return candidate?.place?.opening_hours ?? candidate?.place?.openingHours ?? null;
}

function isLodgingCandidate(candidate) {
  const types = Array.isArray(candidate?.place?.types_raw)
    ? candidate.place.types_raw
    : Array.isArray(candidate?.place?.typesRaw)
      ? candidate.place.typesRaw
      : [];
  return types.some((type) => LODGING_PATTERN.test(String(type || "")));
}

function filterNonLodgingCandidates(candidates) {
  return (candidates || []).filter((candidate) => !isLodgingCandidate(candidate));
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

function getOpenIntervalsForDate(openingHours, visitDate) {
  const weekdayIndex = getWeekdayIndex(visitDate);
  if (weekdayIndex == null) return [];

  const dayStart = weekdayIndex * MINUTES_PER_DAY;
  const dayEnd = dayStart + MINUTES_PER_DAY;
  const intervals = extractOpeningIntervals(openingHours);
  const dayIntervals = [];

  for (const interval of intervals) {
    for (const comparableInterval of getComparableIntervals(interval)) {
      const overlapStart = Math.max(dayStart, comparableInterval.start);
      const overlapEnd = Math.min(dayEnd, comparableInterval.end);
      if (overlapEnd <= overlapStart) continue;
      dayIntervals.push({ start: overlapStart, end: overlapEnd });
    }
  }

  return dayIntervals.sort((left, right) => left.start - right.start);
}

function findMatchingOpeningInterval(intervals, weekMinute) {
  for (const interval of intervals) {
    if (weekMinute >= interval.start && weekMinute < interval.end) {
      return { interval, probeMinute: weekMinute };
    }

    if (interval.end > MINUTES_PER_WEEK) {
      const shiftedProbeMinute = weekMinute + MINUTES_PER_WEEK;
      if (shiftedProbeMinute >= interval.start && shiftedProbeMinute < interval.end) {
        return { interval, probeMinute: shiftedProbeMinute };
      }
    }
  }

  return null;
}

function getCandidateTraits(candidate) {
  const place = candidate?.place || {};
  const category = String(place.category || "")
    .trim()
    .toUpperCase();
  const types = Array.isArray(place.types_raw) ? place.types_raw.map((type) => String(type)) : [];
  const name = String(place.name || "").trim();
  const searchable = [name, category, ...types].join(" ").toLowerCase();
  const priceLevel = getCandidatePriceLevel(candidate);
  const rating = Number.isFinite(Number(place.rating)) ? Number(place.rating) : null;

  const isDessert = DESSERT_PATTERN.test(searchable);
  const isMeal = MEAL_PATTERN.test(searchable) || (category.includes(PLACE_CATEGORY.FOODIE) && !isDessert);
  const isDinnerPreferred = isMeal && (HEAVY_DINNER_PATTERN.test(searchable) || (priceLevel != null && priceLevel >= 2));
  const isNightlife = NIGHTLIFE_PATTERN.test(searchable);
  const isNightView = isViewSpot(candidate) || NIGHT_VIEW_PATTERN.test(searchable);
  const isNight = isNightlife || isNightView;
  const reservationRisk =
    (isMeal || isNightlife) &&
    (RESERVATION_RISK_PATTERN.test(searchable) || (priceLevel != null && priceLevel >= 3));
  const isShopping = category.includes(PLACE_CATEGORY.SHOPPING) || SHOPPING_PATTERN.test(searchable);
  const isLandmark = inferLandmark(place);
  const isMorningFriendly =
    MORNING_FRIENDLY_PATTERN.test(searchable) || isShopping || isLandmark || (isDessert && !isNightlife);

  return {
    category,
    types,
    name,
    priceLevel,
    rating,
    isMeal,
    isDessert,
    isDinnerPreferred,
    isNightlife,
    isNightView,
    isNight,
    reservationRisk,
    isShopping,
    isLandmark,
    isMorningFriendly
  };
}

function resolveMinimumVisitWindowMinutes(label, candidate, requiredMinutes = null) {
  const baseDuration = Number.isFinite(Number(requiredMinutes))
    ? Number(requiredMinutes)
    : resolveStopDurationMinutes(label, candidate);
  const minimumWindow = SLOT_MINIMUM_WINDOW_MINUTES[label] ?? 45;
  return Math.max(minimumWindow, Math.round(baseDuration * 0.6));
}

function evaluateCandidateVisitWindow({ candidate, visitDate, arrivalMinutes, label, requiredMinutes = null }) {
  const normalizedArrivalMinutes = normalizeDayMinutes(arrivalMinutes);
  const openingHours = getCandidateOpeningHours(candidate);
  if (!openingHours || !visitDate || normalizedArrivalMinutes == null) {
    return {
      status: "unknown",
      isKnown: false,
      isOpen: null,
      isSlotValid: true,
      minutesUntilClose: null,
      closeTime: null,
      nextOpenTime: null,
      closedAllDay: false
    };
  }

  const weekdayIndex = getWeekdayIndex(visitDate);
  if (weekdayIndex == null) {
    return {
      status: "unknown",
      isKnown: false,
      isOpen: null,
      isSlotValid: true,
      minutesUntilClose: null,
      closeTime: null,
      nextOpenTime: null,
      closedAllDay: false
    };
  }

  const intervals = extractOpeningIntervals(openingHours);
  if (intervals.length === 0) {
    return {
      status: "unknown",
      isKnown: false,
      isOpen: null,
      isSlotValid: true,
      minutesUntilClose: null,
      closeTime: null,
      nextOpenTime: null,
      closedAllDay: false
    };
  }

  const dayStart = weekdayIndex * MINUTES_PER_DAY;
  const weekMinute = dayStart + normalizedArrivalMinutes;
  const matching = findMatchingOpeningInterval(intervals, weekMinute);
  const dayIntervals = getOpenIntervalsForDate(openingHours, visitDate);

  if (!matching) {
    const nextOpenInterval = dayIntervals.find((interval) => interval.start > weekMinute) || null;
    return {
      status: "closed",
      isKnown: true,
      isOpen: false,
      isSlotValid: false,
      minutesUntilClose: null,
      closeTime: null,
      nextOpenTime: nextOpenInterval ? minutesToTime(nextOpenInterval.start - dayStart) : null,
      closedAllDay: dayIntervals.length === 0
    };
  }

  const minimumWindow = resolveMinimumVisitWindowMinutes(label, candidate, requiredMinutes);
  const minutesUntilClose = matching.interval.end - matching.probeMinute;
  const closeTime = minutesToTime(((matching.interval.end % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY);

  if (minutesUntilClose < minimumWindow) {
    return {
      status: "insufficient_window",
      isKnown: true,
      isOpen: true,
      isSlotValid: false,
      minutesUntilClose,
      closeTime,
      nextOpenTime: null,
      closedAllDay: false
    };
  }

  if (minutesUntilClose < minimumWindow + 30) {
    return {
      status: "tight",
      isKnown: true,
      isOpen: true,
      isSlotValid: true,
      minutesUntilClose,
      closeTime,
      nextOpenTime: null,
      closedAllDay: false
    };
  }

  return {
    status: "open",
    isKnown: true,
    isOpen: true,
    isSlotValid: true,
    minutesUntilClose,
    closeTime,
    nextOpenTime: null,
    closedAllDay: false
  };
}

function buildPromptDaySlotSummary(candidate, tripDays = [], pace) {
  const openingHours = getCandidateOpeningHours(candidate);
  if (!openingHours || extractOpeningIntervals(openingHours).length === 0 || !Array.isArray(tripDays) || tripDays.length === 0) {
    return null;
  }

  const labels = ["MORNING", "LUNCH", "VISIT", "DESSERT", "DINNER", "NIGHT"];
  const summary = tripDays.map((tripDay) => {
    const dayNumber = Number(tripDay?.day);
    const visitDate = tripDay?.date;
    const codes = labels
      .filter((label) => {
        const availability = evaluateCandidateVisitWindow({
          candidate,
          visitDate,
          arrivalMinutes: resolveLabelAnchorMinutes(label, pace, 0),
          label
        });
        return availability.isSlotValid;
      })
      .map((label) => PROMPT_DAY_SLOT_CODES[label]);

    if (!Number.isFinite(dayNumber)) return null;
    return `${dayNumber}:${codes.length > 0 ? codes.join("") : "-"}`;
  });

  return summary.every(Boolean) ? summary : null;
}

function isCandidateCompatibleWithLabel(label, traits) {
  if (label === "LUNCH" || label === "DINNER") {
    return traits.isMeal;
  }

  if (label === "DESSERT") {
    return traits.isDessert;
  }

  if (label === "NIGHT") {
    return traits.isNight;
  }

  return true;
}

function countMatchingCandidates(candidates, predicate) {
  let count = 0;
  for (const candidate of candidates || []) {
    if (predicate(candidate)) count += 1;
  }
  return count;
}

function isDessertHeavyTrip(candidates, generationInput = {}) {
  const dessertCount = countMatchingCandidates(candidates, (candidate) => getCandidateTraits(candidate).isDessert);
  const totalCount = Math.max(1, (candidates || []).length);
  return dessertCount / totalCount >= 0.3 || (isFoodieTrip(generationInput) && dessertCount >= Math.ceil(totalCount / 4));
}

function getThemeMatchScore(candidate, themes) {
  if (!themes.size) return 0;

  const category = String(candidate?.place?.category || "")
    .trim()
    .toUpperCase();
  const types = Array.isArray(candidate?.place?.types_raw) ? candidate.place.types_raw : [];

  let score = 0;

  if (themes.has(category)) {
    score += 3;
  }

  if (themes.has(THEME_CATEGORY.NATURE) && (category === PLACE_CATEGORY.VIEW || category === PLACE_CATEGORY.NATURE)) {
    score += 2;
  }

  if (themes.has(THEME_CATEGORY.FOODIE) && types.some((type) => /restaurant|cafe|bakery|meal|food/i.test(String(type)))) {
    score += 1;
  }

  if (themes.has(THEME_CATEGORY.LANDMARK) && types.some((type) => LANDMARK_PATTERN.test(String(type)))) {
    score += 1;
  }

  if (themes.has(THEME_CATEGORY.SHOPPING) && types.some((type) => SHOPPING_PATTERN.test(String(type)))) {
    score += 1;
  }

  return score;
}

function normalizeCandidates(candidates) {
  const deduped = [];
  const byPlaceId = new Map();

  for (const candidate of filterNonLodgingCandidates(candidates)) {
    const place = candidate?.place;
    if (!place?.id) continue;

    if (!byPlaceId.has(place.id)) {
      const normalized = {
        place,
        note: candidate.note || null,
        priority: Boolean(candidate.priority)
      };
      byPlaceId.set(place.id, normalized);
      deduped.push(normalized);
      continue;
    }

    const existing = byPlaceId.get(place.id);
    existing.priority = existing.priority || Boolean(candidate.priority);
    if (!existing.note && candidate.note) {
      existing.note = candidate.note;
    }
  }

  return deduped;
}

function rankCandidates(normalizedCandidates, generationInput = {}) {
  const themes = normalizeThemes(generationInput.themes);
  return normalizedCandidates
    .map((candidate, index) => {
      const rating = Number(candidate?.place?.rating);
      const traits = getCandidateTraits(candidate);
      return {
        candidate,
        index,
        priorityScore: candidate.priority ? 1 : 0,
        themeScore: getThemeMatchScore(candidate, themes),
        noteScore: candidate.note ? 1 : 0,
        ratingScore: Number.isFinite(rating) ? rating : 0,
        dinnerScore: traits.isDinnerPreferred ? 1 : 0,
        nightScore: traits.isNight ? 1 : 0
      };
    })
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore;
      if (right.themeScore !== left.themeScore) return right.themeScore - left.themeScore;
      if (right.noteScore !== left.noteScore) return right.noteScore - left.noteScore;
      if (right.dinnerScore !== left.dinnerScore) return right.dinnerScore - left.dinnerScore;
      if (right.nightScore !== left.nightScore) return right.nightScore - left.nightScore;
      if (right.ratingScore !== left.ratingScore) return right.ratingScore - left.ratingScore;
      return left.index - right.index;
    });
}

function isPinnedCandidate(candidate) {
  return Boolean(candidate?.priority || candidate?.note);
}

function selectCandidatesForLimit(normalizedCandidates, limit, generationInput = {}, options = {}) {
  const normalizedLimit = Math.max(1, Math.trunc(Number(limit) || 1));
  if (normalizedCandidates.length <= normalizedLimit) {
    return normalizedCandidates;
  }

  if (options.preservePinned) {
    const pinnedPlaceIds = new Set(
      normalizedCandidates.filter((candidate) => isPinnedCandidate(candidate)).map((candidate) => candidate.place.id)
    );

    if (pinnedPlaceIds.size > 0 && pinnedPlaceIds.size < normalizedLimit) {
      const rankedCandidates = rankCandidates(normalizedCandidates, generationInput).map((entry) => entry.candidate);
      const selectedPlaceIds = new Set(pinnedPlaceIds);

      for (const candidate of rankedCandidates) {
        if (selectedPlaceIds.size >= normalizedLimit) break;
        selectedPlaceIds.add(candidate.place.id);
      }

      return normalizedCandidates.filter((candidate) => selectedPlaceIds.has(candidate.place.id));
    }
  }

  const ranked = rankCandidates(normalizedCandidates, generationInput);

  return ranked.slice(0, normalizedLimit).sort((left, right) => left.index - right.index).map((entry) => entry.candidate);
}

function selectCandidatesForTrip(candidates, dayCount, generationInput = {}) {
  const normalizedCandidates = normalizeCandidates(candidates);
  const tripStopLimit = resolveTripStopLimit(dayCount, generationInput);
  return selectCandidatesForLimit(normalizedCandidates, tripStopLimit, generationInput);
}

function selectCandidatesForAiPlanning(candidates, dayCount, generationInput = {}) {
  const normalizedCandidates = normalizeCandidates(candidates);
  const pinnedCount = normalizedCandidates.filter((candidate) => isPinnedCandidate(candidate)).length;
  const keepAllThreshold = pinnedCount > 0 ? 30 : 36;

  if (normalizedCandidates.length <= keepAllThreshold) {
    return normalizedCandidates;
  }

  const tripStopLimit = resolveTripStopLimit(dayCount, generationInput);
  const aiLimit = Math.min(
    normalizedCandidates.length,
    Math.max(tripStopLimit + (pinnedCount > 0 ? 8 : 12), pinnedCount + 8, 32)
  );

  if (aiLimit >= normalizedCandidates.length) {
    return normalizedCandidates;
  }

  return selectCandidatesForLimit(normalizedCandidates, aiLimit, generationInput, {
    preservePinned: true
  });
}

function buildBadges(candidate) {
  const badges = inferLandmark(candidate.place) ? [PLACE_CATEGORY.LANDMARK] : [];
  return appendMustVisitBadge(badges, candidate.priority);
}

function formatWeekday(dateString, outputLanguage) {
  const locale = outputLanguage === "en" ? "en-US" : "ko-KR";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC"
  }).format(new Date(`${dateString}T00:00:00Z`));
}

function buildReason(candidate, transport, outputLanguage, label) {
  const traits = getCandidateTraits(candidate);
  const chunks = [];

  if (outputLanguage === "en") {
    if (label === "DINNER") {
      chunks.push(traits.isDinnerPreferred ? "Placed later to anchor dinner with a stronger meal stop." : "Placed here as the main dinner stop.");
    } else if (label === "NIGHT") {
      chunks.push(traits.isNightView ? "Placed late so this stop works better as a night view." : "Placed after dinner so the evening flow feels natural.");
    } else if (label === "DESSERT") {
      chunks.push("Placed here as a natural cafe or dessert break between bigger stops.");
    } else {
      chunks.push(candidate.priority ? "Placed early because it is marked as a must-visit." : "Placed here to keep the route efficient.");
    }

    if (transport?.travelMinutes) {
      chunks.push(`The next move is about ${formatDurationByLanguage(transport.travelMinutes, outputLanguage)} away.`);
    }
  } else {
    if (label === "DINNER") {
      chunks.push(traits.isDinnerPreferred ? "가격대나 음식 타입을 보고 저녁 메인 식사로 두기 좋아 이 시간대에 넣었어요." : "하루 흐름상 메인 저녁 식사로 두기 좋아 이 시간대에 넣었어요.");
    } else if (label === "NIGHT") {
      chunks.push(traits.isNightView ? "해가 진 뒤에 더 잘 어울리는 장소라 밤 슬롯으로 잡았어요." : "저녁 식사 뒤에 이어 가기 좋아 밤 슬롯으로 넣었어요.");
    } else if (label === "DESSERT") {
      chunks.push("큰 식사 사이에 쉬어 가기 좋은 디저트/카페 타이밍으로 넣었어요.");
    } else {
      chunks.push(candidate.priority ? "MustVisit 장소라 먼저 반영했어요." : "전체 동선과 시간대를 같이 보고 넣었어요.");
    }

    if (transport?.travelMinutes) {
      chunks.push(`다음 이동은 약 ${formatDurationByLanguage(transport.travelMinutes, outputLanguage)} 걸릴 수 있어요.`);
    }
  }

  return chunks.join(" ");
}

function buildVisitTip({ candidate, transport, time, label, visitDate, outputLanguage, availability }) {
  const weekday = visitDate ? formatWeekday(visitDate, outputLanguage) : null;
  const traits = getCandidateTraits(candidate);

  if (availability?.isKnown && availability.status === "tight" && availability.closeTime) {
    if (outputLanguage === "en") {
      return weekday
        ? `Hours look tighter on ${weekday}s here, so arriving by ${time || "this time"} and before about ${availability.closeTime} is safer.`
        : `Try to arrive by ${time || "this time"} because this place gets close to closing around ${availability.closeTime}.`;
    }

    return weekday
      ? `${weekday}엔 영업 마감이 빠듯할 수 있어요. ${time || "이 시간"}쯤 도착해서 ${availability.closeTime} 전에는 들어가는 편이 안전해요.`
      : `${availability.closeTime} 전에는 들어가는 편이 안전해요. 너무 늦지 않게 도착해 보세요.`;
  }

  if (traits.reservationRisk && (label === "DINNER" || label === "NIGHT" || traits.isMeal)) {
    if (outputLanguage === "en") {
      if (label === "DINNER" || label === "NIGHT") {
        return weekday
          ? `Popular dinner slots can fill up on ${weekday}s, so check whether reservations are recommended before you go.`
          : "Dinner or evening seats can fill up quickly, so checking reservation options in advance is safer.";
      }

      return weekday
        ? `Popular meal slots can fill up on ${weekday}s, so check whether reservations are recommended before you go.`
        : "Seats can fill up quickly, so checking reservation options in advance is safer.";
    }

    if (label === "DINNER" || label === "NIGHT") {
      return weekday
        ? `${weekday} 저녁 시간대엔 자리가 빨리 찰 수 있어요. 가기 전에 예약이 필요한지 먼저 확인해 보세요.`
        : "저녁 피크 시간대엔 자리가 빨리 찰 수 있어요. 가기 전에 예약 가능 여부를 한 번 확인해 보세요.";
    }

    return weekday
      ? `${weekday} 인기 시간대엔 자리가 빨리 찰 수 있어요. 가기 전에 예약이 필요한지 먼저 확인해 보세요.`
      : "인기 시간대엔 자리가 빨리 찰 수 있어요. 가기 전에 예약 가능 여부를 한 번 확인해 보세요.";
  }

  if (traits.isNightView && label === "NIGHT") {
    return outputLanguage === "en"
      ? "This stop works best after sunset, so keep it in the later evening slot."
      : "해가 진 뒤에 가야 분위기가 더 살아나요. 너무 이르게 가지 않는 편이 좋아요.";
  }

  if (traits.isMeal) {
    if (outputLanguage === "en") {
      return weekday
        ? `Food hours can shift on ${weekday}s, so check opening hours and arrive around ${time || "meal time"}.`
        : `Arrive around ${time || "meal time"} so this stop still works as a proper meal break.`;
    }

    return weekday
      ? `${weekday} 운영 시간이 달라질 수 있어요. ${time || "식사 시간"} 전에 도착하도록 영업시간을 한 번 더 확인해 보세요.`
      : `${time || "식사 시간"} 전에 도착하면 식사 흐름이 끊기지 않아요. 영업시간을 한 번 더 확인해 보세요.`;
  }

  if (traits.isNight && outputLanguage === "en") {
    return "Evening spots can have last-entry or closing-time quirks, so do a quick hours check before heading over.";
  }

  if (traits.isNight) {
    return "밤 시간대엔 입장 마감이나 운영 시간이 달라질 수 있어요. 가기 전에 한 번 더 확인해 보세요.";
  }

  if (transport?.travelMinutes >= 30) {
    return outputLanguage === "en"
      ? `The transfer takes about ${formatDurationByLanguage(transport.travelMinutes, outputLanguage)}, so leave a little buffer before heading here.`
      : `이동이 약 ${formatDurationByLanguage(transport.travelMinutes, outputLanguage)} 걸릴 수 있어 조금 여유 있게 출발하는 편이 좋아요.`;
  }

  if (visitDate) {
    return outputLanguage === "en"
      ? `Hours can vary on ${weekday}, so do a quick check before you go.`
      : `${weekday} 운영 시간이 달라질 수 있어 방문 전에 한 번 더 확인하는 편이 좋아요.`;
  }

  return outputLanguage === "en"
    ? "Check the latest hours before you go so this stop does not slip in the schedule."
    : "현장 운영 시간이 달라질 수 있으니 가기 전에 한 번 더 확인해 보세요.";
}

function distributeStopCounts(totalStops, dayCount) {
  const normalizedDayCount = Math.max(1, Math.min(dayCount, 30));
  const baseSize = Math.floor(totalStops / normalizedDayCount);
  const remainder = totalStops % normalizedDayCount;

  return Array.from({ length: normalizedDayCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
}

function buildDayLabelPlan({ stopCount, remainingCandidates, daysLeft, generationInput = {} }) {
  if (stopCount <= 0) return [];

  const remainingMealCount = countMatchingCandidates(remainingCandidates, (candidate) => getCandidateTraits(candidate).isMeal);
  const remainingDessertCount = countMatchingCandidates(remainingCandidates, (candidate) => getCandidateTraits(candidate).isDessert);
  const remainingNightCount = countMatchingCandidates(remainingCandidates, (candidate) => getCandidateTraits(candidate).isNight);

  const wantMorning =
    stopCount >= 4 &&
    (String(generationInput.pace || "").toUpperCase() !== "RELAXED" ||
      (isFoodieTrip(generationInput) && remainingMealCount >= 3 && stopCount >= 5));
  const wantLunch = stopCount >= 1 && remainingMealCount > 0;
  const wantDinner = stopCount >= 2 && remainingMealCount > 1;

  let dessertQuota = 0;
  if (isCoupleTrip(generationInput) && remainingDessertCount >= daysLeft && stopCount >= 3) {
    dessertQuota = 1;
  }

  if ((isDessertHeavyTrip(remainingCandidates, generationInput) || isFoodieTrip(generationInput)) && stopCount >= 5) {
    const extraDessertSlots = Math.max(0, remainingDessertCount - dessertQuota);
    dessertQuota += Math.min(extraDessertSlots, isFoodieTrip(generationInput) ? 2 : 1);
  }

  const wantNight =
    wantDinner &&
    remainingNightCount > 0 &&
    ((isGroupTrip(generationInput) && stopCount >= 4) ||
      ((isCoupleTrip(generationInput) || String(generationInput.pace || "").toUpperCase() === "INTENSE") && stopCount >= 5));

  const headLabels = [];
  if (wantMorning) headLabels.push("MORNING");
  if (wantLunch) headLabels.push("LUNCH");

  const tailLabels = [];
  if (wantDinner) tailLabels.unshift("DINNER");
  if (wantNight) tailLabels.push("NIGHT");

  const availableMiddleSlots = Math.max(0, stopCount - headLabels.length - tailLabels.length);
  dessertQuota = Math.min(dessertQuota, availableMiddleSlots);

  const middleLabels = [];
  for (let index = 0; index < dessertQuota; index += 1) {
    middleLabels.push("DESSERT");
  }

  while (headLabels.length + middleLabels.length + tailLabels.length < stopCount) {
    const shouldAddDessert =
      middleLabels.length > 0 &&
      isFoodieTrip(generationInput) &&
      isDessertHeavyTrip(remainingCandidates, generationInput) &&
      middleLabels.length < 3 &&
      middleLabels.length + tailLabels.length + headLabels.length < stopCount;

    middleLabels.unshift(shouldAddDessert ? "DESSERT" : "VISIT");
  }

  const labels = [...headLabels, ...middleLabels, ...tailLabels].slice(0, stopCount);
  if (labels.length === 0) {
    return Array.from({ length: stopCount }, () => "VISIT");
  }

  return labels;
}

function scoreCandidateForLabel({
  candidate,
  label,
  previousCandidate,
  generationInput = {},
  visitDate = null,
  currentMinutes = 0,
  occurrenceIndex = 0
}) {
  const traits = getCandidateTraits(candidate);
  const routeIndex = Number.isFinite(Number(candidate.routeIndex)) ? Number(candidate.routeIndex) : 0;
  const transport = previousCandidate ? estimateTransport(previousCandidate.place, candidate.place) : null;
  const requiredDuration = resolveStopDurationMinutes(label, candidate);
  const anchorMinutes = resolveLabelAnchorMinutes(label, generationInput.pace, occurrenceIndex);
  const arrivalMinutes = Math.max(
    normalizeDayMinutes(currentMinutes + (transport?.travelMinutes || 0)) ?? 0,
    anchorMinutes
  );
  const availability = evaluateCandidateVisitWindow({
    candidate,
    visitDate,
    arrivalMinutes,
    label,
    requiredMinutes: requiredDuration
  });

  if (!isCandidateCompatibleWithLabel(label, traits)) {
    return {
      score: Number.NEGATIVE_INFINITY,
      transport,
      arrivalMinutes,
      availability
    };
  }

  if (availability.isKnown && !availability.isSlotValid) {
    return {
      score: Number.NEGATIVE_INFINITY,
      transport,
      arrivalMinutes,
      availability
    };
  }

  let score = 0;
  score += candidate.priority ? 45 : 0;
  score += candidate.note ? 8 : 0;
  score += Number.isFinite(traits.rating) ? traits.rating * 4 : 0;
  score += Math.max(0, 24 - routeIndex);

  if (transport?.travelMinutes) {
    score -= transport.travelMinutes * 0.65;
  }

  if (availability.status === "tight") {
    score -= 30;
  } else if (availability.isKnown) {
    score += 6;
  }

  if (label === "MORNING") {
    score += traits.isMorningFriendly ? 26 : 0;
    score += traits.isNightlife ? -18 : 0;
    score += traits.isDinnerPreferred ? -10 : 0;
    score += traits.isDessert ? 6 : 0;
    score += isFoodieTrip(generationInput) && traits.isMeal ? 8 : 0;
    score += traits.isLandmark || traits.isShopping ? 8 : 0;
  } else if (label === "LUNCH") {
    score += traits.isMeal ? 55 : -30;
    score += traits.isDessert ? -18 : 0;
    score += traits.isDinnerPreferred ? 4 : 12;
    score += traits.priceLevel != null ? Math.max(0, 4 - traits.priceLevel) * 5 : 0;
  } else if (label === "VISIT") {
    score += !traits.isMeal && !traits.isDessert && !traits.isNight ? 20 : 0;
    score += traits.isLandmark || traits.isShopping ? 10 : 0;
    score += traits.isNight ? -10 : 0;
  } else if (label === "DESSERT") {
    score += traits.isDessert ? 60 : -35;
    score += isCoupleTrip(generationInput) ? 12 : 0;
    score += isFoodieTrip(generationInput) ? 8 : 0;
    score += traits.priceLevel != null ? Math.max(0, 3 - traits.priceLevel) * 2 : 0;
  } else if (label === "DINNER") {
    score += traits.isMeal ? 60 : -35;
    score += traits.isDinnerPreferred ? 20 : 0;
    score += traits.priceLevel != null ? traits.priceLevel * 6 : 0;
    score += traits.reservationRisk ? 6 : 0;
    score += traits.isDessert ? -25 : 0;
  } else if (label === "NIGHT") {
    score += traits.isNight ? 65 : -40;
    score += traits.isNightlife ? 16 : 0;
    score += traits.isNightView ? 14 : 0;
    score += isGroupTrip(generationInput) ? 10 : 0;
    score += isCoupleTrip(generationInput) ? 8 : 0;
    score += isFamilyTrip(generationInput) ? -8 : 0;
  }

  return {
    score,
    transport,
    arrivalMinutes,
    availability
  };
}

function selectCandidateForLabel({
  label,
  remainingCandidates,
  previousCandidate,
  generationInput = {},
  visitDate = null,
  currentMinutes = 0,
  occurrenceIndex = 0
}) {
  if (!remainingCandidates.length) return null;

  let bestCandidate = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestArrivalMinutes = null;
  let bestTransport = null;
  let bestAvailability = null;

  for (const candidate of remainingCandidates) {
    const evaluation = scoreCandidateForLabel({
      candidate,
      label,
      previousCandidate,
      generationInput,
      visitDate,
      currentMinutes,
      occurrenceIndex
    });

    if (evaluation.score > bestScore) {
      bestScore = evaluation.score;
      bestCandidate = candidate;
      bestArrivalMinutes = evaluation.arrivalMinutes;
      bestTransport = evaluation.transport;
      bestAvailability = evaluation.availability;
    }
  }

  if (!bestCandidate || !Number.isFinite(bestScore)) {
    return null;
  }

  return {
    candidate: bestCandidate,
    arrivalMinutes: bestArrivalMinutes,
    transport: bestTransport,
    availability: bestAvailability,
    score: bestScore
  };
}

function removeCandidateByPlaceId(candidates, placeId) {
  const index = candidates.findIndex((candidate) => candidate?.place?.id === placeId);
  if (index >= 0) {
    candidates.splice(index, 1);
  }
}

function pickCandidatesForDay({ remainingCandidates, stopCount, daysLeft = 1, generationInput = {}, tripDay = null }) {
  if (stopCount <= 0) return [];

  const dayWindowSize = Math.max(stopCount * 4, 12);
  const labels = buildDayLabelPlan({
    stopCount,
    remainingCandidates,
    daysLeft,
    generationInput
  });

  const selected = [];
  const occurrenceCounter = new Map();
  let currentMinutes = resolveInitialMinutes(generationInput, labels);

  for (const label of labels) {
    const occurrenceIndex = occurrenceCounter.get(label) || 0;
    occurrenceCounter.set(label, occurrenceIndex + 1);
    const previousCandidate = selected[selected.length - 1]?.candidate || null;
    const windowCandidates = remainingCandidates.slice(0, dayWindowSize);

    let selection = selectCandidateForLabel({
      label,
      remainingCandidates: windowCandidates,
      previousCandidate,
      generationInput,
      visitDate: tripDay?.date || null,
      currentMinutes,
      occurrenceIndex
    });

    if (!selection && remainingCandidates.length > windowCandidates.length) {
      selection = selectCandidateForLabel({
        label,
        remainingCandidates,
        previousCandidate,
        generationInput,
        visitDate: tripDay?.date || null,
        currentMinutes,
        occurrenceIndex
      });
    }

    if (!selection) continue;

    selected.push({
      label,
      candidate: selection.candidate,
      plannedStartMinutes: selection.arrivalMinutes,
      availability: selection.availability
    });
    currentMinutes = selection.arrivalMinutes + resolveStopDurationMinutes(label, selection.candidate);
    removeCandidateByPlaceId(remainingCandidates, selection.candidate.place.id);
  }

  while (selected.length < stopCount) {
    const previousCandidate = selected[selected.length - 1]?.candidate || null;
    const fallbackLabel = "VISIT";
    const occurrenceIndex = occurrenceCounter.get(fallbackLabel) || 0;
    occurrenceCounter.set(fallbackLabel, occurrenceIndex + 1);
    const selection = selectCandidateForLabel({
      label: fallbackLabel,
      remainingCandidates,
      previousCandidate,
      generationInput,
      visitDate: tripDay?.date || null,
      currentMinutes,
      occurrenceIndex
    });

    if (!selection) break;

    selected.push({
      label: fallbackLabel,
      candidate: selection.candidate,
      plannedStartMinutes: selection.arrivalMinutes,
      availability: selection.availability
    });
    currentMinutes = selection.arrivalMinutes + resolveStopDurationMinutes(fallbackLabel, selection.candidate);
    removeCandidateByPlaceId(remainingCandidates, selection.candidate.place.id);
  }

  return selected;
}

function resolveLabelAnchorMinutes(label, pace, occurrenceIndex = 0) {
  const normalizedPace = String(pace || "").toUpperCase();
  const anchorMap = {
    RELAXED: {
      MORNING: 11 * 60,
      LUNCH: 12 * 60,
      VISIT: 14 * 60 + 30,
      DESSERT: 16 * 60 + 30,
      DINNER: 19 * 60,
      NIGHT: 21 * 60
    },
    MODERATE: {
      MORNING: 10 * 60,
      LUNCH: 12 * 60 + 30,
      VISIT: 14 * 60 + 30,
      DESSERT: 16 * 60,
      DINNER: 18 * 60 + 30,
      NIGHT: 20 * 60 + 30
    },
    INTENSE: {
      MORNING: 9 * 60,
      LUNCH: 12 * 60,
      VISIT: 14 * 60,
      DESSERT: 15 * 60 + 30,
      DINNER: 18 * 60,
      NIGHT: 20 * 60
    }
  };

  const preset = anchorMap[normalizedPace] || anchorMap.MODERATE;
  const base = preset[label] ?? preset.VISIT;
  const repeatOffset = label === "VISIT" ? 90 : label === "DESSERT" ? 75 : 60;
  return base + occurrenceIndex * repeatOffset;
}

function resolveStopDurationMinutes(label, candidate) {
  const traits = getCandidateTraits(candidate);

  if (label === "NIGHT") return 100;
  if (label === "DESSERT") return 60;
  if (label === "DINNER") return traits.priceLevel != null && traits.priceLevel >= 3 ? 120 : 100;
  if (label === "LUNCH") return 80;
  if (label === "MORNING") return 75;
  return candidate.priority ? 120 : 90;
}

function resolveInitialMinutes(generationInput = {}, labelPlan = []) {
  const pace = String(generationInput.pace || "").toUpperCase();
  const firstLabel = labelPlan[0] || "VISIT";
  if (pace === "RELAXED" && firstLabel === "LUNCH") return 11 * 60 + 30;
  if (pace === "RELAXED") return 11 * 60;
  if (pace === "INTENSE") return 9 * 60;
  return 10 * 60;
}

function buildDayStops({ daySelections, tripDay, generationInput = {} }) {
  const outputLanguage = String(generationInput.outputLanguage || "ko").toLowerCase() === "en" ? "en" : "ko";

  return daySelections.map((entry, index) => {
    const label = entry.label;
    const candidate = entry.candidate;
    const nextEntry = daySelections[index + 1] || null;
    const transport = nextEntry ? estimateTransport(candidate.place, nextEntry.candidate.place) : null;
    const plannedStartMinutes =
      normalizeDayMinutes(entry.plannedStartMinutes) ?? resolveLabelAnchorMinutes(label, generationInput.pace, 0);
    const time = minutesToTime(plannedStartMinutes);

    const stop = {
      placeId: candidate.place.id,
      time,
      label,
      badges: buildBadges(candidate),
      note: candidate.note || null,
      reason: buildReason(candidate, transport, outputLanguage, label),
      visitTip: buildVisitTip({
        candidate,
        transport,
        time,
        label,
        visitDate: tripDay?.date || null,
        outputLanguage,
        availability:
          entry.availability ||
          evaluateCandidateVisitWindow({
            candidate,
            visitDate: tripDay?.date || null,
            arrivalMinutes: plannedStartMinutes,
            label,
            requiredMinutes: resolveStopDurationMinutes(label, candidate)
          })
      }),
      transportToNext: transport
        ? {
            mode: transport.mode,
            distance: transport.distance,
            duration: transport.duration
          }
        : null
    };
    return stop;
  });
}

function buildSchedulePlan({ candidates, dayCount, stayPlace, generationInput = {} }) {
  const normalizedCandidates = selectCandidatesForTrip(candidates, dayCount, generationInput);
  const prioritized = normalizedCandidates.filter((candidate) => candidate.priority);
  const normal = normalizedCandidates.filter((candidate) => !candidate.priority);
  const orderedCandidates = [
    ...orderCandidatesByNearestNeighbor(prioritized, stayPlace),
    ...orderCandidatesByNearestNeighbor(normal, stayPlace)
  ].map((candidate, routeIndex) => ({
    ...candidate,
    routeIndex
  }));

  const tripDays = Array.isArray(generationInput.tripDays) ? generationInput.tripDays : [];
  const stopCounts = distributeStopCounts(orderedCandidates.length, dayCount);
  const remainingCandidates = [...orderedCandidates];

  return stopCounts.map((stopCount, index) => {
    const dayNumber = index + 1;
    const tripDay = tripDays.find((day) => Number(day.day) === dayNumber) || null;
    const daySelections = pickCandidatesForDay({
      remainingCandidates,
      stopCount,
      daysLeft: Math.max(1, dayCount - index),
      generationInput,
      tripDay
    });

    return {
      dayNumber,
      stops: buildDayStops({
        daySelections,
        tripDay,
        generationInput
      })
    };
  });
}

module.exports = {
  buildSchedulePlan,
  buildPromptDaySlotSummary,
  evaluateCandidateVisitWindow,
  filterNonLodgingCandidates,
  getCandidateTraits,
  isLodgingCandidate,
  resolveLabelAnchorMinutes,
  resolveDailyStopTarget,
  selectCandidatesForAiPlanning
};
