const {
  THEME_CATEGORY,
  buildCanonicalRouteStopLabel
} = require("./route-taxonomy");
const { getOpeningHoursSignals, isUnschedulableBusinessStatus } = require("./googlePlaces");
const { analyzePlaceSignals, deriveScheduleFacets } = require("./place-semantics");

const HEAVY_DINNER_PATTERN =
  /izakaya|yakitori|yakiniku|bbq|barbecue|grill|steak|omakase|sushi|seafood|shabu|sukiyaki|hot_pot|french_restaurant|italian_restaurant|korean_restaurant|wine_bar|bistro|fine_dining/i;
const VIEW_SPOT_PATTERN = /observation|view|tower|lookout|skywalk|wheel|scenic|observatory/i;
const RESERVATION_RISK_PATTERN =
  /izakaya|wine_bar|omakase|sushi_restaurant|seafood_restaurant|french_restaurant|steak|yakitori|yakiniku|fine_dining|bistro/i;
const MORNING_FRIENDLY_PATTERN = /park|museum|market|shopping|cafe|bakery|dessert|tourist_attraction|garden/i;
const HEAVY_ACTIVITY_PATTERN =
  /amusement_park|water_park|zoo|wildlife_park|go_karting_venue|adventure_sports_center|casino|paintball_center|off_roading_area|cycling_park|roller_coaster|childrens_camp/i;
const LIGHT_ACTIVITY_PATTERN =
  /ferris_wheel|video_arcade|karaoke|miniature_golf_course|bowling_alley|comedy_club|dance_hall|live_music_venue|movie_theater/i;
const LONG_VISIT_PATTERN =
  /museum|art_gallery|historical|temple|shrine|church|castle|aquarium|zoo|national_park|botanical_garden|nature_preserve|garden|park/i;
const SHORT_VISIT_PATTERN =
  /market|shopping_mall|plaza|fountain|monument|scenic_spot|observation_deck|visitor_center|ferris_wheel/i;
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;
const FAME_REVIEW_FLOOR = 30;
const FAME_PRIOR_REVIEWS = 100;
const FAME_PRIOR_RATING = 4.2;
const DAY_BUDGET_MINUTES_BY_PACE = {
  RELAXED: 390,
  MODERATE: 510,
  INTENSE: 630
};
const LABEL_LOAD_MINUTES = {
  MORNING: 95,
  LUNCH: 110,
  VISIT: 120,
  DESSERT: 80,
  DINNER: 130,
  NIGHT: 110
};
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

function toTransportPayload(transport) {
  if (!transport) return null;
  return {
    mode: transport.mode,
    distance: transport.distance,
    duration: transport.duration
  };
}

function recomputeStopTransports(stops) {
  const list = Array.isArray(stops) ? stops : [];

  return list.map((stop, index) => ({
    ...stop,
    transportToNext: toTransportPayload(estimateTransport(stop?.place || null, list[index + 1]?.place || null))
  }));
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

function resolveDayBudgetMinutes(generationInput = {}) {
  const pace = String(generationInput.pace || "").toUpperCase();
  return DAY_BUDGET_MINUTES_BY_PACE[pace] || DAY_BUDGET_MINUTES_BY_PACE.MODERATE;
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

function hasTheme(generationInput = {}, theme) {
  return normalizeThemes(generationInput.themes).has(theme);
}

function getCandidateReviewCount(candidate) {
  const value = candidate?.place?.user_rating_count ?? candidate?.place?.userRatingCount;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function inferLandmark(place) {
  const semantics = analyzePlaceSignals({
    categories: Array.isArray(place?.categories) ? place.categories : [],
    primaryType: place?.primary_type || place?.primaryType || null,
    types: Array.isArray(place?.types_raw) ? place.types_raw : Array.isArray(place?.typesRaw) ? place.typesRaw : []
  });
  return semantics.isLandmark;
}

function inferNature(place) {
  const semantics = analyzePlaceSignals({
    categories: Array.isArray(place?.categories) ? place.categories : [],
    primaryType: place?.primary_type || place?.primaryType || null,
    types: Array.isArray(place?.types_raw) ? place.types_raw : Array.isArray(place?.typesRaw) ? place.typesRaw : []
  });
  return semantics.isNature;
}

function isViewSpot(candidate) {
  const types = Array.isArray(candidate?.place?.types_raw)
    ? candidate.place.types_raw
    : Array.isArray(candidate?.place?.typesRaw)
      ? candidate.place.typesRaw
      : [];
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
  const place = candidate?.place || {};
  const semantics = analyzePlaceSignals({
    categories: Array.isArray(place.categories) ? place.categories : [],
    primaryType: place.primary_type || place.primaryType || null,
    types: Array.isArray(place.types_raw) ? place.types_raw : Array.isArray(place.typesRaw) ? place.typesRaw : []
  });
  return semantics.isStay;
}

function isUnschedulableBusinessCandidate(candidate) {
  const place = candidate?.place || {};
  return isUnschedulableBusinessStatus(place.business_status || place.businessStatus);
}

function filterNonLodgingCandidates(candidates) {
  return (candidates || []).filter(
    (candidate) => !isLodgingCandidate(candidate) && !isUnschedulableBusinessCandidate(candidate)
  );
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

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function getCandidateTraits(candidate) {
  const place = candidate?.place || {};
  const name = String(place.name || "").trim();
  const categories = Array.isArray(place.categories) ? place.categories : [];
  const types = Array.isArray(place.types_raw)
    ? place.types_raw.map((type) => String(type || "").trim().toLowerCase()).filter(Boolean)
    : Array.isArray(place.typesRaw)
      ? place.typesRaw.map((type) => String(type || "").trim().toLowerCase()).filter(Boolean)
      : [];
  const primaryType = String(place.primary_type || place.primaryType || "")
    .trim()
    .toLowerCase();
  const searchableMeta = [primaryType, ...types].join(" ").toLowerCase();
  const priceLevel = getCandidatePriceLevel(candidate);
  const rating = Number.isFinite(Number(place.rating)) ? Number(place.rating) : null;
  const reviewCount = getCandidateReviewCount(candidate);
  const openingSignals = getOpeningHoursSignals(getCandidateOpeningHours(candidate));
  const semantics = analyzePlaceSignals({ categories, primaryType, types });
  const scheduleFacets = deriveScheduleFacets({
    types,
    primaryType,
    categories,
    openingSignals
  });
  const isBrunch = semantics.isBrunch;
  const isCafe = semantics.isCafe;
  const isSnack = semantics.isSnack;
  const isDessert = isCafe || isSnack;
  const hasFoodSignal =
    isBrunch ||
    isCafe ||
    isSnack ||
    semantics.hasMealType;
  const preferFoodOverNight =
    semantics.hasStrongMealType ||
    (hasFoodSignal && openingSignals.hasDaytimeService);
  const isMeal = scheduleFacets.canMeal;
  const isDinnerPreferred =
    isMeal && (HEAVY_DINNER_PATTERN.test(searchableMeta) || (priceLevel != null && priceLevel >= 2));
  const hasViewSpotSignal = semantics.isViewSpot || isViewSpot(candidate) || VIEW_SPOT_PATTERN.test(searchableMeta);
  const viewSpotCandidate = hasViewSpotSignal;
  const isNightlife =
    !viewSpotCandidate &&
    (semantics.isNightlife || (semantics.hasIzakayaType && !preferFoodOverNight)) &&
    !preferFoodOverNight;
  const isNight = scheduleFacets.canNight && (isNightlife || viewSpotCandidate);
  const reservationRisk =
    (isMeal || isNightlife) &&
    (RESERVATION_RISK_PATTERN.test(searchableMeta) || (priceLevel != null && priceLevel >= 3));
  const isActivity =
    semantics.isActivity &&
    !semantics.isLandmark &&
    !semantics.isShopping;
  const isShopping = scheduleFacets.canShopping;
  const isLandmark = semantics.isLandmark;
  const isNature = semantics.isNature;
  const isVisitCandidate = scheduleFacets.canVisit;
  const isMorningFriendly =
    MORNING_FRIENDLY_PATTERN.test(searchableMeta) || isVisitCandidate || isBrunch || isCafe || isSnack;
  const mealFit = isBrunch ? "LUNCH" : isDinnerPreferred ? "DINNER" : isMeal ? "BOTH" : null;
  const fameScore =
    rating == null
      ? 0
      : (reviewCount / (reviewCount + FAME_PRIOR_REVIEWS)) * rating +
        (FAME_PRIOR_REVIEWS / (reviewCount + FAME_PRIOR_REVIEWS)) * FAME_PRIOR_RATING;
  const isAnchorMeal =
    isMeal &&
    reviewCount >= FAME_REVIEW_FLOOR &&
    ((fameScore >= 4.3 && reviewCount >= 100) ||
      (fameScore >= 4.2 && reviewCount >= 300) ||
      (fameScore >= 4.1 && reviewCount >= 1000));
  const isAnchorVisit =
    isVisitCandidate &&
    (candidate?.isMustVisit || reviewCount >= 50 || rating >= 4.3);
  const activityLoad =
    !isActivity
      ? 0
      : HEAVY_ACTIVITY_PATTERN.test(searchableMeta)
        ? 1
        : LIGHT_ACTIVITY_PATTERN.test(searchableMeta)
          ? 0.45
          : 0.7;
  const baseVisitDurationMinutes =
    isActivity
      ? activityLoad >= 0.9
        ? 150
        : activityLoad >= 0.65
          ? 110
          : 80
      : isMeal
        ? isDinnerPreferred
          ? 110
          : 90
        : isCafe || isSnack
          ? 60
          : LONG_VISIT_PATTERN.test(searchableMeta)
            ? 120
            : SHORT_VISIT_PATTERN.test(searchableMeta)
              ? 70
              : isVisitCandidate
                ? 95
                : 75;
  const visitAffinity = clamp01(
    (isVisitCandidate ? 0.42 : 0) +
      (isLandmark ? 0.18 : 0) +
      (isNature ? 0.18 : 0) +
      (isShopping ? 0.14 : 0) +
      (isActivity ? 0.12 : 0) +
      (isAnchorVisit ? 0.08 : 0) +
      (candidate?.isMustVisit ? 0.08 : 0)
  );
  const mealAffinity = clamp01(
    (isMeal ? 0.58 : 0) +
      (isDinnerPreferred ? 0.12 : 0) +
      (isAnchorMeal ? 0.14 : 0) +
      (reservationRisk ? 0.04 : 0)
  );
  const cafeAffinity = clamp01(
    (isCafe ? 0.7 : 0) +
      (isSnack ? 0.22 : 0) +
      (isBrunch ? 0.08 : 0)
  );
  const nightAffinity = clamp01(
    (isNight ? 0.52 : 0) +
      (isNightlife ? 0.24 : 0) +
      (viewSpotCandidate ? 0.18 : 0) +
      (candidate?.isMustVisit && isNight ? 0.06 : 0)
  );
  const shoppingAffinity = clamp01(
    (isShopping ? 0.7 : 0) +
      (categories.includes("MARKET") ? 0.14 : 0) +
      (categories.includes("SHOP") ? 0.08 : 0)
  );

  return {
    categories,
    types,
    name,
    priceLevel,
    rating,
    reviewCount,
    isMeal,
    isBrunch,
    isCafe,
    isDessert,
    isSnack,
    isDinnerPreferred,
    isNightlife,
    isViewSpot: viewSpotCandidate,
    isNight,
    reservationRisk,
    isActivity,
    isShopping,
    isLandmark,
    isNature,
    isVisitCandidate,
    isMorningFriendly,
    mealFit,
    fameScore,
    isAnchorMeal,
    isAnchorVisit,
    openingSignals,
    blockedLabels: Array.isArray(scheduleFacets.blockedLabels) ? scheduleFacets.blockedLabels : [],
    canVisit: Boolean(scheduleFacets.canVisit),
    canMeal: Boolean(scheduleFacets.canMeal),
    canCafeBreak: Boolean(scheduleFacets.canCafeBreak),
    canNight: Boolean(scheduleFacets.canNight),
    visitAffinity,
    mealAffinity,
    cafeAffinity,
    nightAffinity,
    shoppingAffinity,
    activityLoad,
    baseVisitDurationMinutes
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
  if (label === "MORNING") {
    return traits.isBrunch || traits.isCafe || traits.isSnack || traits.isVisitCandidate;
  }

  if (label === "LUNCH" || label === "DINNER") {
    return traits.isMeal;
  }

  if (label === "DESSERT") {
    return traits.isCafe || traits.isSnack;
  }

  if (label === "NIGHT") {
    return traits.isNight;
  }

  if (label === "VISIT") {
    return traits.isVisitCandidate;
  }

  return false;
}

function countMatchingCandidates(candidates, predicate) {
  let count = 0;
  for (const candidate of candidates || []) {
    if (predicate(candidate)) count += 1;
  }
  return count;
}

function buildFutureLabelDemand(labels = [], startIndex = 0) {
  const demand = {
    MORNING: 0,
    LUNCH: 0,
    VISIT: 0,
    DESSERT: 0,
    DINNER: 0,
    NIGHT: 0
  };

  for (let index = startIndex; index < labels.length; index += 1) {
    const label = labels[index];
    if (Object.prototype.hasOwnProperty.call(demand, label)) {
      demand[label] += 1;
    }
  }

  return demand;
}

function isDessertHeavyTrip(candidates, generationInput = {}) {
  const dessertCount = countMatchingCandidates(candidates, (candidate) => getCandidateTraits(candidate).isDessert);
  const totalCount = Math.max(1, (candidates || []).length);
  return dessertCount / totalCount >= 0.3 || (isFoodieTrip(generationInput) && dessertCount >= Math.ceil(totalCount / 4));
}

function getThemeMatchScore(candidate, themes) {
  if (!themes.size) return 0;

  const traits = getCandidateTraits(candidate);

  let score = 0;

  if (themes.has(THEME_CATEGORY.FOODIE) && (traits.isMeal || traits.isBrunch || traits.isCafe || traits.isSnack || traits.isNight)) {
    score += traits.isAnchorMeal ? 4 : 2;
  }

  if (themes.has(THEME_CATEGORY.LANDMARK) && traits.isLandmark) {
    score += 4;
  }

  if (themes.has(THEME_CATEGORY.NATURE) && traits.isNature) {
    score += 4;
  }

  if (themes.has(THEME_CATEGORY.SHOPPING) && traits.isShopping) {
    score += 4;
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
        isMustVisit: Boolean(candidate.isMustVisit)
      };
      byPlaceId.set(place.id, normalized);
      deduped.push(normalized);
      continue;
    }

    const existing = byPlaceId.get(place.id);
    existing.isMustVisit = existing.isMustVisit || Boolean(candidate.isMustVisit);
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
        mustVisitScore: candidate.isMustVisit ? 1 : 0,
        themeScore: getThemeMatchScore(candidate, themes),
        noteScore: candidate.note ? 1 : 0,
        ratingScore: Number.isFinite(rating) ? rating : 0,
        fameScore: traits.fameScore || 0,
        dinnerScore: traits.isDinnerPreferred ? 1 : 0,
        nightScore: traits.isNight ? 1 : 0
      };
    })
    .sort((left, right) => {
      if (right.mustVisitScore !== left.mustVisitScore) return right.mustVisitScore - left.mustVisitScore;
      if (right.themeScore !== left.themeScore) return right.themeScore - left.themeScore;
      if (right.fameScore !== left.fameScore) return right.fameScore - left.fameScore;
      if (right.noteScore !== left.noteScore) return right.noteScore - left.noteScore;
      if (right.dinnerScore !== left.dinnerScore) return right.dinnerScore - left.dinnerScore;
      if (right.nightScore !== left.nightScore) return right.nightScore - left.nightScore;
      if (right.ratingScore !== left.ratingScore) return right.ratingScore - left.ratingScore;
      return left.index - right.index;
    });
}

function isPinnedCandidate(candidate) {
  return Boolean(candidate?.isMustVisit || candidate?.note);
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
  return normalizeCandidates(candidates);
}

function selectCandidatesForAiPlanning(candidates, dayCount, generationInput = {}) {
  return normalizeCandidates(candidates);
}

function resolveIsMustVisit(candidate) {
  return Boolean(candidate?.isMustVisit);
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
      chunks.push(traits.isViewSpot ? "Placed late so this stop works better as a night view." : "Placed after dinner so the evening flow feels natural.");
    } else if (label === "DESSERT") {
      chunks.push("Placed here as a natural cafe or dessert break between bigger stops.");
    } else {
      chunks.push(candidate.isMustVisit ? "Placed early because it is marked as a must-visit." : "Placed here to keep the route efficient.");
    }

    if (transport?.travelMinutes) {
      chunks.push(`The next move is about ${formatDurationByLanguage(transport.travelMinutes, outputLanguage)} away.`);
    }
  } else {
    if (label === "DINNER") {
      chunks.push(traits.isDinnerPreferred ? "가격대나 음식 타입을 보고 저녁 메인 식사로 두기 좋아 이 시간대에 넣었어요." : "하루 흐름상 메인 저녁 식사로 두기 좋아 이 시간대에 넣었어요.");
    } else if (label === "NIGHT") {
      chunks.push(traits.isViewSpot ? "해가 진 뒤에 더 잘 어울리는 장소라 밤 슬롯으로 잡았어요." : "저녁 식사 뒤에 이어 가기 좋아 밤 슬롯으로 넣었어요.");
    } else if (label === "DESSERT") {
      chunks.push("큰 식사 사이에 쉬어 가기 좋은 디저트/카페 타이밍으로 넣었어요.");
    } else {
      chunks.push(candidate.isMustVisit ? "MustVisit 장소라 먼저 반영했어요." : "전체 동선과 시간대를 같이 보고 넣었어요.");
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

  if (traits.isViewSpot && label === "NIGHT") {
    return outputLanguage === "en"
      ? "This stop works best after sunset, so keep it in the later evening slot."
      : "해가 진 뒤에 가야 분위기가 더 살아나요. 너무 이르게 가지 않는 편이 좋아요.";
  }

  if (transport?.travelMinutes >= 30) {
    return outputLanguage === "en"
      ? `The transfer takes about ${formatDurationByLanguage(transport.travelMinutes, outputLanguage)}, so leave a little buffer before heading here.`
      : `이동이 약 ${formatDurationByLanguage(transport.travelMinutes, outputLanguage)} 걸릴 수 있어 조금 여유 있게 출발하는 편이 좋아요.`;
  }

  return null;
}

function distributeStopCounts(totalStops, dayCount) {
  const normalizedDayCount = Math.max(1, Math.min(dayCount, 30));
  const baseSize = Math.floor(totalStops / normalizedDayCount);
  const remainder = totalStops % normalizedDayCount;

  return Array.from({ length: normalizedDayCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
}

function scoreCandidateForDaySeed(candidate, stayPlace, generationInput = {}) {
  const traits = getCandidateTraits(candidate);
  const themes = normalizeThemes(generationInput.themes);
  const stayDistanceKm =
    stayPlace?.lat != null &&
    stayPlace?.lng != null &&
    candidate?.place?.lat != null &&
    candidate?.place?.lng != null
      ? haversineKm(stayPlace.lat, stayPlace.lng, candidate.place.lat, candidate.place.lng)
      : 0;

  let score = 0;
  score += candidate.isMustVisit ? 60 : 0;
  score += candidate.note ? 10 : 0;
  score += traits.isAnchorVisit ? 32 : 0;
  score += traits.isAnchorMeal ? 18 : 0;
  score += traits.visitAffinity * 28;
  score += traits.mealAffinity * 10;
  score += traits.shoppingAffinity * 6;
  score += getThemeMatchScore(candidate, themes) * 5;
  score += traits.fameScore * 4;
  score += Math.min(12, stayDistanceKm || 0) * 1.8;
  score += traits.isNight ? -8 : 0;
  return score;
}

function selectDaySeedCandidate(remainingCandidates, stayPlace, generationInput = {}) {
  let bestCandidate = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of remainingCandidates || []) {
    const score = scoreCandidateForDaySeed(candidate, stayPlace, generationInput);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

function buildDayLabelPlan({ remainingCandidates, daysLeft, generationInput = {} }) {
  const pace = String(generationInput.pace || "").toUpperCase();
  const dayBudgetMinutes = resolveDayBudgetMinutes(generationInput);
  const mealCount = countMatchingCandidates(remainingCandidates, (candidate) => getCandidateTraits(candidate).isMeal);
  const brunchLikeCount = countMatchingCandidates(remainingCandidates, (candidate) => {
    const traits = getCandidateTraits(candidate);
    return traits.isBrunch || traits.isCafe || traits.isSnack;
  });
  const dessertCount = countMatchingCandidates(remainingCandidates, (candidate) => {
    const traits = getCandidateTraits(candidate);
    return traits.isCafe || traits.isSnack;
  });
  const nightCount = countMatchingCandidates(remainingCandidates, (candidate) => getCandidateTraits(candidate).isNight);
  const visitAnchorCount = countMatchingCandidates(remainingCandidates, (candidate) => getCandidateTraits(candidate).isVisitCandidate);
  const mustVisitVisitCount = countMatchingCandidates(remainingCandidates, (candidate) => {
    const traits = getCandidateTraits(candidate);
    return candidate.isMustVisit && traits.isVisitCandidate;
  });
  const mustVisitNightCount = countMatchingCandidates(remainingCandidates, (candidate) => {
    const traits = getCandidateTraits(candidate);
    return candidate.isMustVisit && traits.isNight;
  });

  if (mealCount < 2) {
    return [];
  }

  const anchorThreshold = Math.min(2, Math.max(1, Number(generationInput.dayCount) || Math.max(1, daysLeft)));
  const activeVisitTheme =
    (hasTheme(generationInput, THEME_CATEGORY.LANDMARK) &&
      countMatchingCandidates(remainingCandidates, (candidate) => getCandidateTraits(candidate).isLandmark) >= anchorThreshold) ||
    (hasTheme(generationInput, THEME_CATEGORY.NATURE) &&
      countMatchingCandidates(remainingCandidates, (candidate) => getCandidateTraits(candidate).isNature) >= anchorThreshold) ||
    (hasTheme(generationInput, THEME_CATEGORY.SHOPPING) &&
      countMatchingCandidates(remainingCandidates, (candidate) => getCandidateTraits(candidate).isShopping) >= anchorThreshold);

  const labels = ["LUNCH", "DINNER"];
  let remainingBudget =
    dayBudgetMinutes -
    resolveLabelLoadMinutes("LUNCH") -
    resolveLabelLoadMinutes("DINNER");

  if (remainingBudget <= 0) {
    return labels;
  }

  const wantsFoodieMorning = isFoodieTrip(generationInput) && brunchLikeCount > 0;
  const wantsVisitMorning = !wantsFoodieMorning && activeVisitTheme && visitAnchorCount > 0 && pace !== "RELAXED";
  const optionalBlocks = [];

  if (wantsFoodieMorning || wantsVisitMorning) {
    optionalBlocks.push({
      label: "MORNING",
      priority: wantsFoodieMorning ? 92 : 72
    });
  }

  const maxVisitSlots = Math.min(4, visitAnchorCount);
  for (let index = 0; index < maxVisitSlots; index += 1) {
    optionalBlocks.push({
      label: "VISIT",
      priority:
        (mustVisitVisitCount > index ? 104 : 0) +
        (activeVisitTheme ? 86 : 70) +
        (pace === "INTENSE" ? 10 : pace === "RELAXED" ? -8 : 0) -
        index * 12
    });
  }

  const wantsDessert =
    dessertCount > 0 &&
    (isFoodieTrip(generationInput) || isCoupleTrip(generationInput) || resolveDailyStopTarget(generationInput) >= 4);
  if (wantsDessert) {
    optionalBlocks.push({
      label: "DESSERT",
      priority: isFoodieTrip(generationInput) ? 88 : isCoupleTrip(generationInput) ? 72 : 58
    });
  }

  if (nightCount > 0) {
    optionalBlocks.push({
      label: "NIGHT",
      priority: mustVisitNightCount > 0 ? 96 : pace === "INTENSE" ? 72 : 54
    });
  }

  if (nightCount > 1 && pace === "INTENSE") {
    optionalBlocks.push({
      label: "NIGHT",
      priority: 44
    });
  }

  const selectedOptionalLabels = [];
  const sortedOptionalBlocks = optionalBlocks.sort((left, right) => right.priority - left.priority);

  for (const block of sortedOptionalBlocks) {
    const load = resolveLabelLoadMinutes(block.label);
    if (remainingBudget < load) continue;

    selectedOptionalLabels.push(block.label);
    remainingBudget -= load;
  }

  const morningLabels = selectedOptionalLabels.filter((label) => label === "MORNING");
  const visitLabels = selectedOptionalLabels.filter((label) => label === "VISIT");
  const dessertLabels = selectedOptionalLabels.filter((label) => label === "DESSERT");
  const nightLabels = selectedOptionalLabels.filter((label) => label === "NIGHT");

  return [
    ...morningLabels,
    "LUNCH",
    ...visitLabels,
    ...dessertLabels,
    "DINNER",
    ...nightLabels
  ];
}

function scoreCandidateForLabel({
  candidate,
  label,
  previousCandidate,
  daySeedCandidate = null,
  generationInput = {},
  visitDate = null,
  currentMinutes = 0,
  dayBudgetMinutes = null,
  consumedBudgetMinutes = 0,
  futureLabelDemand = null,
  occurrenceIndex = 0,
  dailyActivityCount = 0
}) {
  const traits = getCandidateTraits(candidate);
  const routeIndex = Number.isFinite(Number(candidate.routeIndex)) ? Number(candidate.routeIndex) : 0;
  const transportOrigin = previousCandidate?.place || daySeedCandidate?.place || null;
  const transport = transportOrigin ? estimateTransport(transportOrigin, candidate.place) : null;
  const requiredDuration = resolveStopDurationMinutes(label, candidate);
  const anchorMinutes = resolveLabelAnchorMinutes(label, generationInput.pace, occurrenceIndex);
  const arrivalMinutes = Math.max(
    normalizeDayMinutes(currentMinutes + (transport?.travelMinutes || 0)) ?? 0,
    anchorMinutes
  );
  const projectedEndMinutes = arrivalMinutes + resolveLabelLoadMinutes(label, candidate);
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

  if (traits.blockedLabels.includes(label)) {
    return {
      score: Number.NEGATIVE_INFINITY,
      transport,
      arrivalMinutes,
      availability
    };
  }

  if (traits.isActivity && dailyActivityCount >= 1) {
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

  if (
    Number.isFinite(dayBudgetMinutes) &&
    consumedBudgetMinutes + resolveLabelLoadMinutes(label, candidate) > dayBudgetMinutes
  ) {
    return {
      score: Number.NEGATIVE_INFINITY,
      transport,
      arrivalMinutes,
      availability
    };
  }

  let score = 0;
  score += candidate.isMustVisit ? 45 : 0;
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

  const futureNightDemand = Number(futureLabelDemand?.NIGHT || 0);

  if (daySeedCandidate?.place?.id && candidate?.place?.id === daySeedCandidate.place.id) {
    score += 18;
  }

  if (
    daySeedCandidate?.place?.lat != null &&
    daySeedCandidate?.place?.lng != null &&
    candidate?.place?.lat != null &&
    candidate?.place?.lng != null
  ) {
    const distanceFromSeedKm = haversineKm(
      daySeedCandidate.place.lat,
      daySeedCandidate.place.lng,
      candidate.place.lat,
      candidate.place.lng
    );
    score += distanceFromSeedKm <= 1.2 ? 12 : distanceFromSeedKm <= 3 ? 6 : 0;
    score -= Math.min(36, distanceFromSeedKm * 2.8);
  }

  if (label === "MORNING") {
    score += traits.isBrunch ? 40 : 0;
    score += traits.isCafe ? 24 : 0;
    score += traits.isSnack ? 16 : 0;
    score += !isFoodieTrip(generationInput) && traits.isVisitCandidate ? 18 : 0;
    score += traits.isActivity ? 12 : 0;
    score += traits.isNight ? -24 : 0;
    score += traits.cafeAffinity * 16;
    score += traits.visitAffinity * 10;
  } else if (label === "LUNCH") {
    score += traits.isMeal ? 55 : -30;
    score += traits.isDessert ? -18 : 0;
    score += traits.isDinnerPreferred ? 4 : 12;
    score += traits.priceLevel != null ? Math.max(0, 4 - traits.priceLevel) * 5 : 0;
    score += traits.fameScore * 6;
    score += traits.mealAffinity * 18;
  } else if (label === "VISIT") {
    score += traits.isVisitCandidate ? 40 : -80;
    score += traits.isActivity ? 16 : 0;
    score += traits.isLandmark ? (hasTheme(generationInput, THEME_CATEGORY.LANDMARK) ? 20 : 8) : 0;
    score += traits.isNature ? (hasTheme(generationInput, THEME_CATEGORY.NATURE) ? 20 : 8) : 0;
    score += traits.isShopping ? (hasTheme(generationInput, THEME_CATEGORY.SHOPPING) ? 18 : 6) : 0;
    score += traits.isMeal || traits.isBrunch || traits.isCafe || traits.isSnack ? -60 : 0;
    score += traits.isAnchorVisit ? 8 : 0;
    score += traits.visitAffinity * 28;
    score -= traits.nightAffinity * 30;
    if (futureNightDemand > 0 && traits.isNight) {
      score -= traits.isViewSpot ? 90 : 50;
    }
  } else if (label === "DESSERT") {
    score += traits.isCafe ? 64 : 0;
    score += traits.isSnack ? 56 : -35;
    score += isCoupleTrip(generationInput) ? 12 : 0;
    score += isFoodieTrip(generationInput) ? 8 : 0;
    score += traits.priceLevel != null ? Math.max(0, 3 - traits.priceLevel) * 2 : 0;
    score += traits.cafeAffinity * 24;
  } else if (label === "DINNER") {
    score += traits.isMeal ? 60 : -35;
    score += traits.isDinnerPreferred ? 20 : 0;
    score += traits.priceLevel != null ? traits.priceLevel * 6 : 0;
    score += traits.reservationRisk ? 6 : 0;
    score += traits.isDessert ? -25 : 0;
    score += traits.fameScore * 10;
    score += traits.mealAffinity * 24;
  } else if (label === "NIGHT") {
    score += traits.isNight ? 65 : -40;
    score += traits.isNightlife ? 16 : 0;
    score += traits.isViewSpot ? 14 : 0;
    score += isGroupTrip(generationInput) ? 10 : 0;
    score += isCoupleTrip(generationInput) ? 8 : 0;
    score += isFamilyTrip(generationInput) ? -8 : 0;
    score += traits.nightAffinity * 24;
    score += traits.isViewSpot ? 18 : 0;
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
  daySeedCandidate = null,
  generationInput = {},
  visitDate = null,
  currentMinutes = 0,
  dayBudgetMinutes = null,
  consumedBudgetMinutes = 0,
  futureLabelDemand = null,
  occurrenceIndex = 0,
  dailyActivityCount = 0
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
      daySeedCandidate,
      generationInput,
      visitDate,
      currentMinutes,
      dayBudgetMinutes,
      consumedBudgetMinutes,
      futureLabelDemand,
      occurrenceIndex,
      dailyActivityCount
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

function pickCandidatesForDay({
  remainingCandidates,
  daysLeft = 1,
  generationInput = {},
  tripDay = null,
  stayPlace = null,
  preferredSeedCandidate = null
}) {
  const daySeedCandidate = preferredSeedCandidate || selectDaySeedCandidate(remainingCandidates, stayPlace, generationInput);
  const labels = buildDayLabelPlan({
    remainingCandidates,
    daysLeft,
    generationInput
  });
  if (labels.length === 0) return [];

  const selected = [];
  const occurrenceCounter = new Map();
  let dailyActivityCount = 0;
  const dayStartMinutes = resolveInitialMinutes(generationInput, labels);
  const dayBudgetMinutes = resolveDayBudgetMinutes(generationInput);
  let currentMinutes = dayStartMinutes;
  let consumedBudgetMinutes = 0;

  for (let labelIndex = 0; labelIndex < labels.length; labelIndex += 1) {
    const label = labels[labelIndex];
    const futureLabelDemand = buildFutureLabelDemand(labels, labelIndex + 1);
    const occurrenceIndex = occurrenceCounter.get(label) || 0;
    occurrenceCounter.set(label, occurrenceIndex + 1);
    const previousCandidate = selected[selected.length - 1]?.candidate || null;
    const selection = selectCandidateForLabel({
      label,
      remainingCandidates,
      previousCandidate,
      daySeedCandidate,
      generationInput,
      visitDate: tripDay?.date || null,
      currentMinutes,
      dayBudgetMinutes,
      consumedBudgetMinutes,
      futureLabelDemand,
      occurrenceIndex,
      dailyActivityCount
    });

    if (!selection) {
      if (label === "LUNCH" || label === "DINNER") {
        return [];
      }
      continue;
    }

    selected.push({
      label,
      candidate: selection.candidate,
      plannedStartMinutes: selection.arrivalMinutes,
      availability: selection.availability
    });
    if (getCandidateTraits(selection.candidate).isActivity) {
      dailyActivityCount += 1;
    }
    currentMinutes = selection.arrivalMinutes + resolveStopDurationMinutes(label, selection.candidate);
    consumedBudgetMinutes += resolveLabelLoadMinutes(label, selection.candidate);
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

  if (label === "NIGHT") return traits.isViewSpot ? 80 : traits.isNightlife ? 110 : 100;
  if (label === "DESSERT") return 60;
  if (label === "DINNER") return traits.priceLevel != null && traits.priceLevel >= 3 ? 120 : 100;
  if (label === "LUNCH") return 80;
  if (label === "MORNING") return 75;
  return candidate.isMustVisit ? Math.max(120, traits.baseVisitDurationMinutes) : traits.baseVisitDurationMinutes;
}

function resolveLabelLoadMinutes(label, candidate = null) {
  const baseDuration = candidate ? resolveStopDurationMinutes(label, candidate) : LABEL_LOAD_MINUTES[label] || 110;
  const transferBuffer =
    label === "DINNER"
      ? 30
      : label === "LUNCH"
        ? 20
        : label === "VISIT"
          ? 25
          : label === "DESSERT"
            ? 15
            : label === "NIGHT"
              ? 20
              : 20;

  return baseDuration + transferBuffer;
}

function resolveInitialMinutes(generationInput = {}, labelPlan = []) {
  const pace = String(generationInput.pace || "").toUpperCase();
  const firstLabel = labelPlan[0] || "VISIT";
  if (pace === "RELAXED" && firstLabel === "LUNCH") return 11 * 60 + 30;
  if (pace === "RELAXED") return 11 * 60;
  if (pace === "INTENSE") return 9 * 60;
  return 10 * 60;
}

function estimateCandidateClusterLoadMinutes(candidate) {
  const traits = getCandidateTraits(candidate);

  if (traits.isMeal) {
    return traits.isDinnerPreferred ? 130 : 110;
  }

  if (traits.isCafe || traits.isSnack) {
    return 75;
  }

  if (traits.isNight) {
    return traits.isViewSpot ? 85 : 105;
  }

  if (traits.isActivity) {
    return Math.round(70 + traits.activityLoad * 90);
  }

  return Math.max(75, traits.baseVisitDurationMinutes + 20);
}

function resolveCandidatePreferredLabels(candidate) {
  const traits = getCandidateTraits(candidate);

  if (traits.isMeal && traits.isNight) {
    return ["DINNER", "NIGHT", "LUNCH"];
  }

  if (traits.isMeal) {
    return traits.isDinnerPreferred ? ["DINNER", "LUNCH"] : ["LUNCH", "DINNER"];
  }

  if (traits.isNight) {
    return traits.isViewSpot ? ["NIGHT", "VISIT"] : ["NIGHT"];
  }

  if (traits.isCafe || traits.isSnack) {
    return ["DESSERT", "MORNING"];
  }

  if (traits.isVisitCandidate) {
    return ["VISIT", "MORNING"];
  }

  return ["VISIT"];
}

function scoreCandidateDayFeasibility(candidate, tripDay, generationInput = {}) {
  if (!tripDay?.date) return 0;

  const preferredLabels = resolveCandidatePreferredLabels(candidate);
  let sawKnownAvailability = false;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const label of preferredLabels) {
    const availability = evaluateCandidateVisitWindow({
      candidate,
      visitDate: tripDay.date,
      arrivalMinutes: resolveLabelAnchorMinutes(label, generationInput.pace, 0),
      label
    });

    if (!availability.isKnown) {
      bestScore = Math.max(bestScore, 0);
      continue;
    }

    sawKnownAvailability = true;
    if (availability.isSlotValid) {
      const labelWeight =
        label === "DINNER" || label === "NIGHT"
          ? 16
          : label === "VISIT"
            ? 14
            : label === "DESSERT"
              ? 10
              : 12;
      const tightPenalty = availability.status === "tight" ? 6 : 0;
      bestScore = Math.max(bestScore, labelWeight - tightPenalty);
      continue;
    }

    bestScore = Math.max(bestScore, -28);
  }

  if (!sawKnownAvailability) {
    return bestScore === Number.NEGATIVE_INFINITY ? 0 : bestScore;
  }

  return bestScore;
}

function computeBucketCentroid(bucket, stayPlace = null) {
  const points = (bucket?.candidates || [])
    .map((candidate) => candidate?.place)
    .filter((place) => Number.isFinite(Number(place?.lat)) && Number.isFinite(Number(place?.lng)));

  if (points.length === 0) {
    return stayPlace && Number.isFinite(Number(stayPlace?.lat)) && Number.isFinite(Number(stayPlace?.lng))
      ? { lat: Number(stayPlace.lat), lng: Number(stayPlace.lng) }
      : null;
  }

  const sums = points.reduce(
    (acc, point) => {
      acc.lat += Number(point.lat);
      acc.lng += Number(point.lng);
      return acc;
    },
    { lat: 0, lng: 0 }
  );

  return {
    lat: sums.lat / points.length,
    lng: sums.lng / points.length
  };
}

function createDayBucket(dayNumber, tripDay = null, seedCandidate = null) {
  return {
    dayNumber,
    tripDay,
    seedCandidate,
    candidates: [],
    estimatedLoadMinutes: 0,
    mealCount: 0,
    visitCount: 0,
    cafeBreakCount: 0,
    nightCount: 0
  };
}

function addCandidateToBucket(bucket, candidate) {
  if (!bucket || !candidate) return;
  if (bucket.candidates.some((entry) => entry?.place?.id === candidate?.place?.id)) return;

  const traits = getCandidateTraits(candidate);
  bucket.candidates.push(candidate);
  bucket.estimatedLoadMinutes += estimateCandidateClusterLoadMinutes(candidate);
  if (traits.isMeal) bucket.mealCount += 1;
  if (traits.isVisitCandidate) bucket.visitCount += 1;
  if (traits.isCafe || traits.isSnack) bucket.cafeBreakCount += 1;
  if (traits.isNight) bucket.nightCount += 1;
}

function removeCandidateFromBucket(bucket, placeId) {
  if (!bucket || !placeId) return null;
  const index = bucket.candidates.findIndex((candidate) => candidate?.place?.id === placeId);
  if (index < 0) return null;

  const [removed] = bucket.candidates.splice(index, 1);
  const traits = getCandidateTraits(removed);
  bucket.estimatedLoadMinutes = Math.max(0, bucket.estimatedLoadMinutes - estimateCandidateClusterLoadMinutes(removed));
  if (traits.isMeal) bucket.mealCount = Math.max(0, bucket.mealCount - 1);
  if (traits.isVisitCandidate) bucket.visitCount = Math.max(0, bucket.visitCount - 1);
  if (traits.isCafe || traits.isSnack) bucket.cafeBreakCount = Math.max(0, bucket.cafeBreakCount - 1);
  if (traits.isNight) bucket.nightCount = Math.max(0, bucket.nightCount - 1);
  return removed;
}

function scoreCandidateForBucketAssignment(candidate, bucket, stayPlace = null, generationInput = {}) {
  const traits = getCandidateTraits(candidate);
  const centroid = computeBucketCentroid(bucket, stayPlace);
  const dayBudgetMinutes = resolveDayBudgetMinutes(generationInput);
  const candidateLoad = estimateCandidateClusterLoadMinutes(candidate);
  let score = 0;

  if (centroid && Number.isFinite(Number(candidate?.place?.lat)) && Number.isFinite(Number(candidate?.place?.lng))) {
    const distanceKm = haversineKm(centroid.lat, centroid.lng, Number(candidate.place.lat), Number(candidate.place.lng));
    score -= distanceKm * 4.2;
    if (distanceKm <= 1.2) score += 16;
    else if (distanceKm <= 3) score += 8;
  }

  if (bucket.seedCandidate?.place?.id && bucket.seedCandidate.place.id === candidate?.place?.id) {
    score += 24;
  }

  if (traits.isMeal && bucket.mealCount < 2) {
    score += (2 - bucket.mealCount) * 36;
  } else if (traits.isMeal && bucket.mealCount >= 2) {
    score -= (bucket.mealCount - 1) * 6;
  }

  if ((traits.isCafe || traits.isSnack) && bucket.cafeBreakCount < 1) {
    score += 12;
  }

  if (traits.isNight && bucket.nightCount < 1) {
    score += 14;
  }

  if (traits.isVisitCandidate && bucket.visitCount < 2) {
    score += 10;
  }

  score += scoreCandidateDayFeasibility(candidate, bucket.tripDay, generationInput);

  const projectedLoad = bucket.estimatedLoadMinutes + candidateLoad;
  if (projectedLoad > dayBudgetMinutes * 1.65) {
    score -= 60;
  } else if (projectedLoad > dayBudgetMinutes * 1.3) {
    score -= 24;
  } else if (projectedLoad <= dayBudgetMinutes * 1.05) {
    score += 10;
  }

  if (candidate.isMustVisit) {
    score += 40;
  }

  if (candidate.note) {
    score += 10;
  }

  score += traits.visitAffinity * 12;
  score += traits.mealAffinity * 10;
  score += traits.nightAffinity * 8;
  score += getThemeMatchScore(candidate, normalizeThemes(generationInput.themes)) * 4;

  return score;
}

function selectClusterSeeds(candidates, activeDayCount, stayPlace = null, generationInput = {}) {
  const uniqueCandidates = Array.isArray(candidates) ? candidates : [];
  if (activeDayCount <= 0 || uniqueCandidates.length === 0) {
    return [];
  }

  const anchorPool = uniqueCandidates.filter((candidate) => {
    const traits = getCandidateTraits(candidate);
    return candidate.isMustVisit || traits.isVisitCandidate || traits.isNight;
  });
  const pool = anchorPool.length >= activeDayCount ? anchorPool : uniqueCandidates;
  const remaining = [...pool];
  const selected = [];

  while (selected.length < activeDayCount && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      let score = scoreCandidateForDaySeed(candidate, stayPlace, generationInput);

      if (selected.length > 0 && Number.isFinite(Number(candidate?.place?.lat)) && Number.isFinite(Number(candidate?.place?.lng))) {
        const minDistanceToExistingSeed = Math.min(
          ...selected
            .filter((seed) => Number.isFinite(Number(seed?.place?.lat)) && Number.isFinite(Number(seed?.place?.lng)))
            .map((seed) => haversineKm(seed.place.lat, seed.place.lng, candidate.place.lat, candidate.place.lng))
        );
        if (Number.isFinite(minDistanceToExistingSeed)) {
          score += Math.min(18, minDistanceToExistingSeed * 3.5);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const [picked] = remaining.splice(bestIndex, 1);
    selected.push(picked);
  }

  return selected;
}

function resolveActiveDayCount(candidates, dayCount) {
  const normalizedDayCount = Math.max(1, Number(dayCount) || 1);
  const mealCandidateCount = countMatchingCandidates(candidates, (candidate) => getCandidateTraits(candidate).isMeal);
  const maxSupportedByMeals = Math.max(1, Math.floor(mealCandidateCount / 2));
  return Math.max(1, Math.min(normalizedDayCount, maxSupportedByMeals, (candidates || []).length));
}

function rebalanceMealCandidatesAcrossBuckets(buckets, stayPlace = null, generationInput = {}) {
  const donors = () => buckets.filter((bucket) => bucket.mealCount > 2);
  const receivers = () => buckets.filter((bucket) => bucket.mealCount < 2);

  while (donors().length > 0 && receivers().length > 0) {
    let moved = false;

    for (const receiver of receivers()) {
      let bestMove = null;

      for (const donor of donors()) {
        const movableMeals = donor.candidates.filter((candidate) => {
          const traits = getCandidateTraits(candidate);
          return traits.isMeal && donor.seedCandidate?.place?.id !== candidate?.place?.id;
        });

        for (const candidate of movableMeals) {
          const receiverScore = scoreCandidateForBucketAssignment(candidate, receiver, stayPlace, generationInput);
          const donorScore = scoreCandidateForBucketAssignment(candidate, donor, stayPlace, generationInput);
          const delta = receiverScore - donorScore;

          if (!bestMove || delta > bestMove.delta) {
            bestMove = { donor, receiver, candidate, delta };
          }
        }
      }

      if (bestMove && bestMove.delta > -12) {
        const movedCandidate = removeCandidateFromBucket(bestMove.donor, bestMove.candidate.place.id);
        if (movedCandidate) {
          addCandidateToBucket(bestMove.receiver, movedCandidate);
          moved = true;
        }
      }
    }

    if (!moved) {
      break;
    }
  }
}

function enforceMealCoverageAcrossBuckets(buckets, stayPlace = null, generationInput = {}) {
  const safeBuckets = Array.isArray(buckets) ? buckets : [];
  const totalMealCount = safeBuckets.reduce((sum, bucket) => sum + Number(bucket?.mealCount || 0), 0);
  const requiredMealCount = safeBuckets.length * 2;
  if (totalMealCount < requiredMealCount) {
    return;
  }

  let guard = 0;
  while (guard < 100) {
    guard += 1;
    const receiver = safeBuckets
      .filter((bucket) => (bucket?.mealCount || 0) < 2)
      .sort((left, right) => (left.mealCount || 0) - (right.mealCount || 0))[0];

    if (!receiver) {
      return;
    }

    let bestMove = null;

    for (const donor of safeBuckets) {
      if ((donor?.mealCount || 0) <= 2) continue;

      const movableMeals = (donor.candidates || []).filter((candidate) => {
        const traits = getCandidateTraits(candidate);
        return traits.isMeal && donor.seedCandidate?.place?.id !== candidate?.place?.id;
      });

      for (const candidate of movableMeals) {
        const receiverScore = scoreCandidateForBucketAssignment(candidate, receiver, stayPlace, generationInput);
        const donorPenalty = scoreCandidateForBucketAssignment(candidate, donor, stayPlace, generationInput) * 0.25;
        const score = receiverScore - donorPenalty;

        if (!bestMove || score > bestMove.score) {
          bestMove = { donor, receiver, candidate, score };
        }
      }
    }

    if (!bestMove) {
      return;
    }

    const movedCandidate = removeCandidateFromBucket(bestMove.donor, bestMove.candidate.place.id);
    if (!movedCandidate) {
      return;
    }
    addCandidateToBucket(bestMove.receiver, movedCandidate);
  }
}

function buildDayClusters({ candidates, dayCount, stayPlace = null, generationInput = {} }) {
  const normalizedCandidates = Array.isArray(candidates) ? candidates : [];
  const activeDayCount = resolveActiveDayCount(normalizedCandidates, dayCount);
  const tripDays = Array.isArray(generationInput.tripDays) ? generationInput.tripDays : [];
  const seeds = selectClusterSeeds(normalizedCandidates, activeDayCount, stayPlace, generationInput);
  const seedIds = new Set(seeds.map((candidate) => candidate?.place?.id).filter(Boolean));
  const activeBuckets = Array.from({ length: activeDayCount }, (_, index) => {
    const dayNumber = index + 1;
    const tripDay = tripDays.find((day) => Number(day.day) === dayNumber) || null;
    return createDayBucket(dayNumber, tripDay, null);
  });

  const unseededBucketIndexes = new Set(activeBuckets.map((_, index) => index));
  for (const seedCandidate of seeds) {
    let bestBucketIndex = [...unseededBucketIndexes][0] ?? 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const bucketIndex of unseededBucketIndexes) {
      const bucket = activeBuckets[bucketIndex];
      const score =
        scoreCandidateDayFeasibility(seedCandidate, bucket.tripDay, generationInput) +
        scoreCandidateForDaySeed(seedCandidate, stayPlace, generationInput);

      if (score > bestScore) {
        bestScore = score;
        bestBucketIndex = bucketIndex;
      }
    }

    const targetBucket = activeBuckets[bestBucketIndex];
    targetBucket.seedCandidate = seedCandidate;
    addCandidateToBucket(targetBucket, seedCandidate);
    unseededBucketIndexes.delete(bestBucketIndex);
  }

  const mealCandidates = normalizedCandidates.filter(
    (candidate) => !seedIds.has(candidate?.place?.id) && getCandidateTraits(candidate).isMeal
  );
  const nonMealCandidates = normalizedCandidates.filter(
    (candidate) => !seedIds.has(candidate?.place?.id) && !getCandidateTraits(candidate).isMeal
  );

  const assignCandidateList = (list) => {
    for (const candidate of list) {
      let bestBucket = activeBuckets[0] || null;
      let bestScore = Number.NEGATIVE_INFINITY;

      for (const bucket of activeBuckets) {
        const score = scoreCandidateForBucketAssignment(candidate, bucket, stayPlace, generationInput);
        if (score > bestScore) {
          bestScore = score;
          bestBucket = bucket;
        }
      }

      if (bestBucket) {
        addCandidateToBucket(bestBucket, candidate);
      }
    }
  };

  assignCandidateList(
    mealCandidates.sort((left, right) => {
      const rightTraits = getCandidateTraits(right);
      const leftTraits = getCandidateTraits(left);
      if (right.isMustVisit !== left.isMustVisit) return Number(right.isMustVisit) - Number(left.isMustVisit);
      return rightTraits.mealAffinity - leftTraits.mealAffinity;
    })
  );

  rebalanceMealCandidatesAcrossBuckets(activeBuckets, stayPlace, generationInput);
  enforceMealCoverageAcrossBuckets(activeBuckets, stayPlace, generationInput);

  assignCandidateList(
    nonMealCandidates.sort((left, right) => {
      const rightTraits = getCandidateTraits(right);
      const leftTraits = getCandidateTraits(left);
      const rightScore = (right.isMustVisit ? 100 : 0) + rightTraits.visitAffinity * 20 + rightTraits.nightAffinity * 14;
      const leftScore = (left.isMustVisit ? 100 : 0) + leftTraits.visitAffinity * 20 + leftTraits.nightAffinity * 14;
      return rightScore - leftScore;
    })
  );

  const allBuckets = Array.from({ length: dayCount }, (_, index) => {
    const existing = activeBuckets[index];
    if (existing) return existing;
    const dayNumber = index + 1;
    const tripDay = tripDays.find((day) => Number(day.day) === dayNumber) || null;
    return createDayBucket(dayNumber, tripDay, null);
  });

  return allBuckets;
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
      isMustVisit: resolveIsMustVisit(candidate),
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
  const orderedCandidates = rankCandidates(normalizedCandidates, generationInput).map((entry, routeIndex) => ({
    ...entry.candidate,
    routeIndex
  }));
  const dayBuckets = buildDayClusters({
    candidates: orderedCandidates,
    dayCount,
    stayPlace,
    generationInput
  });

  return dayBuckets.map((bucket, index) => {
    const daySelections = pickCandidatesForDay({
      remainingCandidates: [...(bucket.candidates || [])],
      daysLeft: Math.max(1, dayBuckets.length - index),
      generationInput,
      tripDay: bucket.tripDay || null,
      stayPlace,
      preferredSeedCandidate: bucket.seedCandidate || null
    });

    return {
      dayNumber: bucket.dayNumber,
      stops: buildDayStops({
        daySelections,
        tripDay: bucket.tripDay || null,
        generationInput
      })
    };
  });
}

module.exports = {
  buildReason,
  buildSchedulePlan,
  buildVisitTip,
  buildPromptDaySlotSummary,
  recomputeStopTransports,
  evaluateCandidateVisitWindow,
  filterNonLodgingCandidates,
  getCandidateTraits,
  isLodgingCandidate,
  resolveLabelAnchorMinutes,
  resolveDailyStopTarget,
  resolveStopDurationMinutes,
  selectCandidatesForAiPlanning,
  __internals: {
    buildDayClusters,
    buildDayLabelPlan,
    resolveDayBudgetMinutes
  }
};
