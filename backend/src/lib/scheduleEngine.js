const {
  PLACE_CATEGORY,
  THEME_CATEGORY,
  buildCanonicalRouteStopLabel
} = require("./route-taxonomy");
const { getOpeningHoursSignals } = require("./googlePlaces");

const MEAL_PATTERN =
  /restaurant|meal|ramen|sushi|yakitori|yakiniku|bbq|barbecue|grill|shabu|sukiyaki|hot_pot|steak|seafood|bistro|diner|tempura|udon|soba|katsu|burger|pizza|pasta|food_court/i;
const STRONG_MEAL_PATTERN =
  /ramen|sushi|yakiniku|steak|seafood|korean_restaurant|italian_restaurant|french_restaurant|pizza|burger|udon|soba|tempura|shabu|hot_pot|tonkatsu|curry|western_restaurant|chicken_restaurant|gyukatsu|okonomiyaki|규카츠|돈카츠|카츠|오코노미야키|라멘|초밥|스시|우동|소바|샤브|스키야키/i;
const BRUNCH_PATTERN =
  /breakfast|brunch|toast|sandwich|bagel|pancake|morning|브런치|모닝|아침/i;
const CAFE_PATTERN =
  /cafe|coffee|tea|roastery|espresso|latte|카페|커피|로스터리|찻집/i;
const SNACK_PATTERN =
  /dessert|pastry|bakery|patisserie|confectionery|juice_shop|ice_cream|gelato|macaron|cake|cheesecake|pudding|chocolate|donut|crepe|sweets|sweet|takoyaki|taiyaki|cookie|croquette|street_food|snack/i;
const HEAVY_DINNER_PATTERN =
  /izakaya|yakitori|yakiniku|bbq|barbecue|grill|steak|omakase|sushi|seafood|shabu|sukiyaki|hot_pot|french_restaurant|italian_restaurant|korean_restaurant|wine_bar|bistro|fine_dining/i;
const DESSERT_PATTERN = new RegExp(`${SNACK_PATTERN.source}|${CAFE_PATTERN.source}`, "i");
const NIGHTLIFE_PATTERN =
  /bar|pub|wine_bar|cocktail|beer|night_club|club|karaoke|live_music|speakeasy/i;
const NIGHT_VIEW_PATTERN = /observation|view|tower|lookout|skywalk|wheel|night_view|scenic|observatory/i;
const ACTIVITY_PATTERN =
  /amusement_center|amusement_park|bowling_alley|video_arcade|sports_activity_location|sports_complex|go_kart_track|public_bath|sauna/i;
const GENERIC_MEAL_TYPE_PATTERN = /^(restaurant|food|food_store)$/i;
const GENERIC_DESSERT_TYPE_PATTERN = /^cafe$/i;
const COMPLEX_VENUE_TYPE_PATTERN =
  /shopping_mall|department_store|tourist_attraction|museum|park|art_gallery|temple|shinto_shrine|shrine|church|mosque|synagogue|stadium|arena|amusement_park|zoo|aquarium/i;
const NIGHTLIFE_TYPE_PATTERN =
  /^(bar|pub|wine_bar|cocktail_bar|beer_hall|beer_garden|sports_bar|night_club|club|karaoke|live_music_venue|speakeasy|japanese_izakaya_restaurant|izakaya)$/i;
const IZAKAYA_TYPE_PATTERN = /^(japanese_izakaya_restaurant|izakaya)$/i;
const RESERVATION_RISK_PATTERN =
  /izakaya|wine_bar|omakase|sushi_restaurant|seafood_restaurant|french_restaurant|steak|yakitori|yakiniku|fine_dining|bistro/i;
const LODGING_PATTERN = /hotel|lodging|hostel|motel|guest|inn|resort|ryokan|accommodation/i;
const SHOPPING_PATTERN =
  /shopping|shopping_mall|mall|market|department_store|drugstore|toy_store|gift_shop|clothing_store|electronics_store|furniture_store|book_store|shoe_store|jewelry_store|outlet/i;
const LANDMARK_PATTERN = /tourist_attraction|museum|art_gallery|landmark|temple|castle|historical/i;
const NATURE_PATTERN = /natural_feature|national_park|garden|botanical_garden|beach|mountain|waterfall|forest|park|hiking/i;
const MORNING_FRIENDLY_PATTERN = /park|museum|market|shopping|cafe|bakery|dessert|tourist_attraction|garden/i;
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;
const FAME_REVIEW_FLOOR = 30;
const FAME_PRIOR_REVIEWS = 100;
const FAME_PRIOR_RATING = 4.2;
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
  const category = String(place?.category || "").toUpperCase();
  if (category === PLACE_CATEGORY.LANDMARK) {
    return true;
  }

  const types = Array.isArray(place.types_raw) ? place.types_raw : [];
  return types.some((type) => LANDMARK_PATTERN.test(String(type)));
}

function inferNature(place) {
  const category = String(place?.category || "").toUpperCase();
  if (category === PLACE_CATEGORY.NATURE) {
    return true;
  }

  const types = Array.isArray(place?.types_raw) ? place.types_raw : [];
  return types.some((type) => NATURE_PATTERN.test(String(type)));
}

function isViewSpot(candidate) {
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
  if (String(candidate?.place?.category || "").trim().toUpperCase() === PLACE_CATEGORY.STAY) {
    return true;
  }

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
  const types = Array.isArray(place.types_raw)
    ? place.types_raw.map((type) => String(type || "").trim().toLowerCase()).filter(Boolean)
    : Array.isArray(place.typesRaw)
      ? place.typesRaw.map((type) => String(type || "").trim().toLowerCase()).filter(Boolean)
      : [];
  const name = String(place.name || "").trim();
  const searchableName = name.toLowerCase();
  const searchableMeta = [category, ...types].join(" ").toLowerCase();
  const priceLevel = getCandidatePriceLevel(candidate);
  const rating = Number.isFinite(Number(place.rating)) ? Number(place.rating) : null;
  const reviewCount = getCandidateReviewCount(candidate);
  const openingSignals = getOpeningHoursSignals(getCandidateOpeningHours(candidate));
  const isNightCategory = category === PLACE_CATEGORY.NIGHT;
  const isComplexVenue =
    category === PLACE_CATEGORY.ACTIVITY ||
    category === PLACE_CATEGORY.SHOP ||
    category === PLACE_CATEGORY.LANDMARK ||
    category === PLACE_CATEGORY.NATURE ||
    types.some((type) => COMPLEX_VENUE_TYPE_PATTERN.test(type));
  const hasExplicitMealType = types.some(
    (type) => MEAL_PATTERN.test(type) && !GENERIC_MEAL_TYPE_PATTERN.test(type)
  );
  const hasGenericMealType = types.some((type) => GENERIC_MEAL_TYPE_PATTERN.test(type));
  const hasExplicitBrunchType = types.some((type) => BRUNCH_PATTERN.test(type));
  const hasExplicitCafeType = types.some((type) => CAFE_PATTERN.test(type));
  const hasExplicitDessertType = types.some(
    (type) => DESSERT_PATTERN.test(type) && !GENERIC_DESSERT_TYPE_PATTERN.test(type)
  );
  const hasGenericDessertType = types.some((type) => GENERIC_DESSERT_TYPE_PATTERN.test(type));
  const hasIzakayaType = types.some((type) => IZAKAYA_TYPE_PATTERN.test(type));
  const hasStrongMealType = types.some((type) => STRONG_MEAL_PATTERN.test(type) && !IZAKAYA_TYPE_PATTERN.test(type));
  const hasNightlifeType = types.some((type) => NIGHTLIFE_TYPE_PATTERN.test(type));
  const hasMealNameHint = MEAL_PATTERN.test(searchableName);
  const hasStrongMealNameHint = STRONG_MEAL_PATTERN.test(searchableName);
  const hasBrunchNameHint = BRUNCH_PATTERN.test(searchableName);
  const hasCafeNameHint = CAFE_PATTERN.test(searchableName);
  const hasDessertNameHint = DESSERT_PATTERN.test(searchableName);
  const hasNightlifeNameHint = NIGHTLIFE_PATTERN.test(searchableName);
  const hasActivityType = types.some((type) => ACTIVITY_PATTERN.test(type));
  const isBrunch =
    category === PLACE_CATEGORY.BRUNCH ||
    hasExplicitBrunchType ||
    hasBrunchNameHint;
  const isCafe =
    category === PLACE_CATEGORY.CAFE ||
    ((!hasExplicitMealType || hasExplicitBrunchType) && (hasExplicitCafeType || hasCafeNameHint));
  const isSnack =
    category === PLACE_CATEGORY.SNACK ||
    hasDessertNameHint ||
    (!isComplexVenue && (hasExplicitDessertType || hasGenericDessertType));
  const isDessert = isCafe || isSnack;
  const hasFoodSignal =
    isBrunch ||
    isCafe ||
    isSnack ||
    hasExplicitMealType ||
    hasGenericMealType ||
    hasMealNameHint ||
    hasStrongMealNameHint;
  const preferFoodOverNight =
    hasStrongMealType ||
    hasStrongMealNameHint ||
    (hasFoodSignal && openingSignals.hasDaytimeService);
  const isMeal =
    !isNightCategory &&
    (category === PLACE_CATEGORY.MEAL ||
      hasMealNameHint ||
      hasExplicitMealType ||
      (!isComplexVenue && hasGenericMealType && !isDessert && !isBrunch));
  const isDinnerPreferred =
    isMeal && (HEAVY_DINNER_PATTERN.test(searchableMeta) || (priceLevel != null && priceLevel >= 2));
  const hasNightViewSignal = isViewSpot(candidate) || NIGHT_VIEW_PATTERN.test(`${searchableName} ${searchableMeta}`);
  const isNightView = hasNightViewSignal;
  const isNightlife =
    !isNightView &&
    (isNightCategory || hasNightlifeType || hasNightlifeNameHint) &&
    !preferFoodOverNight;
  const isNight = isNightCategory || isNightlife || isNightView;
  const nightSubtype = isNightView
    ? "VIEW"
    : /night_club|club/i.test(searchableMeta)
      ? "CLUB"
      : /live_music/i.test(searchableMeta)
        ? "LIVE"
        : isNightlife
          ? "BAR"
          : "OTHER";
  const reservationRisk =
    (isMeal || isNightlife) &&
    (RESERVATION_RISK_PATTERN.test(searchableMeta) || (priceLevel != null && priceLevel >= 3));
  const isActivity =
    category === PLACE_CATEGORY.ACTIVITY ||
    (hasActivityType && category !== PLACE_CATEGORY.LANDMARK && category !== PLACE_CATEGORY.SHOP);
  const isShopping = category === PLACE_CATEGORY.SHOP || SHOPPING_PATTERN.test(searchableMeta);
  const isLandmark = inferLandmark(place);
  const isNature = inferNature(place);
  const isVisitCandidate = isShopping || isLandmark || isNature || isActivity;
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

  return {
    category,
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
    isNightView,
    isNight,
    nightSubtype,
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
    isAnchorVisit
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
      chunks.push(traits.isNightView ? "Placed late so this stop works better as a night view." : "Placed after dinner so the evening flow feels natural.");
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
      chunks.push(traits.isNightView ? "해가 진 뒤에 더 잘 어울리는 장소라 밤 슬롯으로 잡았어요." : "저녁 식사 뒤에 이어 가기 좋아 밤 슬롯으로 넣었어요.");
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

  if (traits.isNightView && label === "NIGHT") {
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

function buildDayLabelPlan({ remainingCandidates, daysLeft, generationInput = {} }) {
  const totalDays = Math.max(1, Number(generationInput.dayCount) || Math.max(1, daysLeft));
  const pace = String(generationInput.pace || "").toUpperCase();
  const softStopTarget = resolveDailyStopTarget(generationInput) + (isFoodieTrip(generationInput) ? 1 : 0);
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

  const anchorThreshold = Math.min(2, totalDays);
  const activeVisitTheme =
    (hasTheme(generationInput, THEME_CATEGORY.LANDMARK) &&
      countMatchingCandidates(remainingCandidates, (candidate) => getCandidateTraits(candidate).isLandmark) >= anchorThreshold) ||
    (hasTheme(generationInput, THEME_CATEGORY.NATURE) &&
      countMatchingCandidates(remainingCandidates, (candidate) => getCandidateTraits(candidate).isNature) >= anchorThreshold) ||
    (hasTheme(generationInput, THEME_CATEGORY.SHOPPING) &&
      countMatchingCandidates(remainingCandidates, (candidate) => getCandidateTraits(candidate).isShopping) >= anchorThreshold);

  const labels = [];
  const middleLabels = [];
  const wantsFoodieMorning = isFoodieTrip(generationInput) && brunchLikeCount > 0;
  const wantsVisitMorning = !wantsFoodieMorning && activeVisitTheme && visitAnchorCount > 0 && pace !== "RELAXED";
  if (wantsFoodieMorning || wantsVisitMorning) {
    labels.push("MORNING");
  }

  labels.push("LUNCH");

  let visitQuota = 0;
  if (mustVisitVisitCount > 0) {
    visitQuota = Math.max(visitQuota, Math.ceil(mustVisitVisitCount / Math.max(1, daysLeft)));
  }
  if (activeVisitTheme && visitAnchorCount > 0) {
    visitQuota = Math.max(visitQuota, 1);
  } else if (!hasTheme(generationInput, THEME_CATEGORY.SHOPPING) && visitAnchorCount > daysLeft) {
    visitQuota = Math.max(visitQuota, 1);
  }
  if (pace === "INTENSE" && visitAnchorCount > daysLeft * 2) {
    visitQuota = Math.max(visitQuota, 2);
  }
  visitQuota = Math.min(2, visitQuota);

  const wantsDessert = dessertCount > 0 && (isFoodieTrip(generationInput) || isCoupleTrip(generationInput) || softStopTarget >= 5);
  const dessertQuota = wantsDessert ? 1 : 0;
  const nonNightLimit = Math.max(2, softStopTarget);
  const maxMiddleSlots = Math.max(0, nonNightLimit - labels.length - 1);

  if (isFoodieTrip(generationInput) && dessertQuota > 0 && middleLabels.length < maxMiddleSlots) {
    middleLabels.push("DESSERT");
  }

  for (let index = 0; index < visitQuota && middleLabels.length < maxMiddleSlots; index += 1) {
    middleLabels.push("VISIT");
  }

  if (!isFoodieTrip(generationInput) && dessertQuota > 0 && middleLabels.length < maxMiddleSlots) {
    middleLabels.push("DESSERT");
  }

  labels.push(...middleLabels, "DINNER");

  let nightQuota = nightCount > 0 ? 1 : 0;
  if (mustVisitNightCount > 0) {
    nightQuota = Math.max(nightQuota, Math.ceil(mustVisitNightCount / Math.max(1, daysLeft)));
  }
  if (pace === "INTENSE" && nightCount > daysLeft) {
    nightQuota = Math.max(nightQuota, 2);
  }
  nightQuota = Math.min(2, nightQuota);

  for (let index = 0; index < nightQuota; index += 1) {
    labels.push("NIGHT");
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
  occurrenceIndex = 0,
  dailyActivityCount = 0
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

  if (label === "MORNING") {
    score += traits.isBrunch ? 40 : 0;
    score += traits.isCafe ? 24 : 0;
    score += traits.isSnack ? 16 : 0;
    score += !isFoodieTrip(generationInput) && traits.isVisitCandidate ? 18 : 0;
    score += traits.isActivity ? 12 : 0;
    score += traits.isNight ? -24 : 0;
  } else if (label === "LUNCH") {
    score += traits.isMeal ? 55 : -30;
    score += traits.isDessert ? -18 : 0;
    score += traits.isDinnerPreferred ? 4 : 12;
    score += traits.priceLevel != null ? Math.max(0, 4 - traits.priceLevel) * 5 : 0;
    score += traits.fameScore * 6;
  } else if (label === "VISIT") {
    score += traits.isVisitCandidate ? 40 : -80;
    score += traits.isActivity ? 16 : 0;
    score += traits.isLandmark ? (hasTheme(generationInput, THEME_CATEGORY.LANDMARK) ? 20 : 8) : 0;
    score += traits.isNature ? (hasTheme(generationInput, THEME_CATEGORY.NATURE) ? 20 : 8) : 0;
    score += traits.isShopping ? (hasTheme(generationInput, THEME_CATEGORY.SHOPPING) ? 18 : 6) : 0;
    score += traits.isMeal || traits.isBrunch || traits.isCafe || traits.isSnack ? -60 : 0;
    score += traits.isAnchorVisit ? 8 : 0;
  } else if (label === "DESSERT") {
    score += traits.isCafe ? 64 : 0;
    score += traits.isSnack ? 56 : -35;
    score += isCoupleTrip(generationInput) ? 12 : 0;
    score += isFoodieTrip(generationInput) ? 8 : 0;
    score += traits.priceLevel != null ? Math.max(0, 3 - traits.priceLevel) * 2 : 0;
  } else if (label === "DINNER") {
    score += traits.isMeal ? 60 : -35;
    score += traits.isDinnerPreferred ? 20 : 0;
    score += traits.priceLevel != null ? traits.priceLevel * 6 : 0;
    score += traits.reservationRisk ? 6 : 0;
    score += traits.isDessert ? -25 : 0;
    score += traits.fameScore * 10;
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
      generationInput,
      visitDate,
      currentMinutes,
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

function pickCandidatesForDay({ remainingCandidates, daysLeft = 1, generationInput = {}, tripDay = null }) {
  const labels = buildDayLabelPlan({
    remainingCandidates,
    daysLeft,
    generationInput
  });
  if (labels.length === 0) return [];

  const selected = [];
  const occurrenceCounter = new Map();
  let dailyActivityCount = 0;
  let currentMinutes = resolveInitialMinutes(generationInput, labels);

  for (const label of labels) {
    const occurrenceIndex = occurrenceCounter.get(label) || 0;
    occurrenceCounter.set(label, occurrenceIndex + 1);
    const previousCandidate = selected[selected.length - 1]?.candidate || null;
    const selection = selectCandidateForLabel({
      label,
      remainingCandidates,
      previousCandidate,
      generationInput,
      visitDate: tripDay?.date || null,
      currentMinutes,
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
  return candidate.isMustVisit ? 120 : 90;
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
  const prioritized = normalizedCandidates.filter((candidate) => candidate.isMustVisit);
  const normal = normalizedCandidates.filter((candidate) => !candidate.isMustVisit);
  const orderedCandidates = [
    ...orderCandidatesByNearestNeighbor(prioritized, stayPlace),
    ...orderCandidatesByNearestNeighbor(normal, stayPlace)
  ].map((candidate, routeIndex) => ({
    ...candidate,
    routeIndex
  }));

  const tripDays = Array.isArray(generationInput.tripDays) ? generationInput.tripDays : [];
  const remainingCandidates = [...orderedCandidates];
  let allowMoreDays = true;

  return Array.from({ length: dayCount }, (_, index) => {
    const dayNumber = index + 1;
    const tripDay = tripDays.find((day) => Number(day.day) === dayNumber) || null;
    const daySelections = allowMoreDays
      ? pickCandidatesForDay({
          remainingCandidates,
          daysLeft: Math.max(1, dayCount - index),
          generationInput,
          tripDay
        })
      : [];

    if (allowMoreDays && daySelections.length === 0) {
      allowMoreDays = false;
    }

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
  selectCandidatesForAiPlanning
};
