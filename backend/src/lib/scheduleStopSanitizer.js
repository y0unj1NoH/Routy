const {
  buildReason,
  buildVisitTip,
  evaluateCandidateVisitWindow,
  getCandidateTraits,
  resolveStopDurationMinutes
} = require("./scheduleEngine");
const {
  ROUTE_STOP_LABEL_FALLBACK,
  ROUTE_STOP_LABEL_VALUES,
  buildCanonicalRouteStopLabel
} = require("./route-taxonomy");

const ROUTE_STOP_LABEL_SET = new Set([...ROUTE_STOP_LABEL_VALUES]);
const LUNCH_START_MINUTES = 11 * 60;
const DINNER_START_MINUTES = 16 * 60;
const DESSERT_START_MINUTES = 14 * 60;
const EARLY_AFTERNOON_MINUTES = 12 * 60;
const NIGHT_START_MINUTES = 19 * 60;
const MORNING_END_MINUTES = 11 * 60;
const LOW_SIGNAL_VISIT_TIP_PATTERNS = [
  /운영 시간이 달라질 수/i,
  /영업시간을 한 번 더 확인/i,
  /방문 전에 한 번 더 확인/i,
  /입장 마감이나 운영 시간이 달라질 수/i,
  /현장 운영 시간이 달라질 수/i,
  /hours can vary/i,
  /check opening hours/i,
  /quick hours check/i,
  /check the latest hours/i
];

function parseTimeToMinutes(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function normalizeStopLabel(label, index, totalStops) {
  const normalized = String(label || "")
    .trim()
    .toUpperCase();

  if (ROUTE_STOP_LABEL_SET.has(normalized)) {
    return normalized;
  }

  if (normalized === "START" || normalized === "FINISH") {
    return buildCanonicalRouteStopLabel(index, totalStops);
  }

  if (normalized === "BREAKFAST" || normalized === "BRUNCH") {
    return "MORNING";
  }

  if (normalized === "AFTERNOON" || normalized === "CAFE" || normalized === "SNACK") {
    return "DESSERT";
  }

  if (normalized === "SUPPER") {
    return "DINNER";
  }

  if (
    normalized === "BAR" ||
    normalized === "PUB" ||
    normalized === "CLUB" ||
    normalized === "NIGHTLIFE" ||
    normalized === "LATE_NIGHT"
  ) {
    return "NIGHT";
  }

  return buildCanonicalRouteStopLabel(index, totalStops) || ROUTE_STOP_LABEL_FALLBACK;
}

function isLabelCompatibleWithTraits(label, traits) {
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

function inferLabelFromTraitsAndTime(traits, timeMinutes, index, totalStops) {
  if (Number.isFinite(timeMinutes)) {
    if (traits.isNight && timeMinutes >= NIGHT_START_MINUTES) {
      return "NIGHT";
    }

    if ((traits.isBrunch || traits.isCafe || traits.isSnack) && timeMinutes < MORNING_END_MINUTES) {
      return "MORNING";
    }

    if (traits.isMeal && timeMinutes >= DINNER_START_MINUTES) {
      return "DINNER";
    }

    if (traits.isMeal) {
      return "LUNCH";
    }

    if ((traits.isCafe || traits.isSnack) && timeMinutes >= DESSERT_START_MINUTES) {
      return "DESSERT";
    }

    if (traits.isVisitCandidate && timeMinutes < MORNING_END_MINUTES) {
      return "MORNING";
    }

    if (traits.isVisitCandidate && timeMinutes >= MORNING_END_MINUTES) {
      return "VISIT";
    }
  }

  if (traits.isNight) {
    return "NIGHT";
  }

  if (traits.isCafe || traits.isSnack) {
    return "DESSERT";
  }

  if (traits.isMeal) {
    return Number.isFinite(timeMinutes) && timeMinutes >= DINNER_START_MINUTES ? "DINNER" : "LUNCH";
  }

  if (traits.isVisitCandidate) {
    return "VISIT";
  }

  return buildCanonicalRouteStopLabel(index, totalStops) || ROUTE_STOP_LABEL_FALLBACK;
}

function normalizeOutputLanguage(outputLanguage) {
  return String(outputLanguage || "").trim().toLowerCase() === "en" ? "en" : "ko";
}

function stripLowSignalVisitTip(value) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;
  if (LOW_SIGNAL_VISIT_TIP_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return null;
  }

  return normalized;
}

function buildCandidateFromStop(stop) {
  return {
    place: stop.place,
    isMustVisit: Boolean(stop.isMustVisit),
    note: stop.note || null
  };
}

function rebuildGeneratedCopy(stop, label, visitDate, outputLanguage) {
  const candidate = buildCandidateFromStop(stop);
  const arrivalMinutes = parseTimeToMinutes(stop.time);
  const normalizedLanguage = normalizeOutputLanguage(outputLanguage);
  const availability =
    Number.isFinite(arrivalMinutes) && visitDate
      ? evaluateCandidateVisitWindow({
          candidate,
          visitDate,
          arrivalMinutes,
          label,
          requiredMinutes: resolveStopDurationMinutes(label, candidate)
        })
      : null;

  return {
    reason: buildReason(candidate, null, normalizedLanguage, label),
    visitTip: stripLowSignalVisitTip(
      buildVisitTip({
        candidate,
        transport: null,
        time: stop.time,
        label,
        visitDate,
        outputLanguage: normalizedLanguage,
        availability
      })
    )
  };
}

function resolveSemanticOverrideForGenericLabel(normalizedLabel, traits, timeMinutes) {
  if (normalizedLabel !== "VISIT" && normalizedLabel !== "MORNING") {
    return null;
  }

  if (traits.isNight && Number.isFinite(timeMinutes) && timeMinutes >= NIGHT_START_MINUTES) {
    return "NIGHT";
  }

  if (traits.isMeal) {
    if (Number.isFinite(timeMinutes) && timeMinutes >= DINNER_START_MINUTES) {
      return "DINNER";
    }

    if (Number.isFinite(timeMinutes) && timeMinutes >= LUNCH_START_MINUTES) {
      return "LUNCH";
    }

    if (normalizedLabel === "VISIT") {
      return "LUNCH";
    }
  }

  if (traits.isBrunch || traits.isCafe || traits.isSnack) {
    if (Number.isFinite(timeMinutes) && timeMinutes < MORNING_END_MINUTES) {
      return "MORNING";
    }

    if (Number.isFinite(timeMinutes) && timeMinutes >= DESSERT_START_MINUTES) {
      return "DESSERT";
    }

    if (normalizedLabel === "VISIT" && (!Number.isFinite(timeMinutes) || timeMinutes >= EARLY_AFTERNOON_MINUTES)) {
      return "DESSERT";
    }
  }

  if (traits.isVisitCandidate) {
    if (Number.isFinite(timeMinutes) && timeMinutes < MORNING_END_MINUTES) {
      return "MORNING";
    }

    return "VISIT";
  }

  return null;
}

function resolveCompatibleStopLabel({ label, place, time, index, totalStops }) {
  const normalizedLabel = normalizeStopLabel(label, index, totalStops);
  const traits = getCandidateTraits({ place });
  const timeMinutes = parseTimeToMinutes(time);
  const semanticOverrideLabel = resolveSemanticOverrideForGenericLabel(normalizedLabel, traits, timeMinutes);

  if (semanticOverrideLabel) {
    return semanticOverrideLabel;
  }

  if (isLabelCompatibleWithTraits(normalizedLabel, traits)) {
    return normalizedLabel;
  }

  const inferredLabel = inferLabelFromTraitsAndTime(traits, timeMinutes, index, totalStops);
  if (
    isLabelCompatibleWithTraits(inferredLabel, traits) ||
    inferredLabel === "VISIT" ||
    inferredLabel === "MORNING"
  ) {
    return inferredLabel;
  }

  const canonicalLabel = buildCanonicalRouteStopLabel(index, totalStops);
  if (
    isLabelCompatibleWithTraits(canonicalLabel, traits) ||
    canonicalLabel === "VISIT" ||
    canonicalLabel === "MORNING"
  ) {
    return canonicalLabel;
  }

  if (traits.isNight) return "NIGHT";
  if (traits.isCafe || traits.isSnack) return Number.isFinite(timeMinutes) && timeMinutes < MORNING_END_MINUTES ? "MORNING" : "DESSERT";
  if (traits.isMeal) return Number.isFinite(timeMinutes) && timeMinutes >= DINNER_START_MINUTES ? "DINNER" : "LUNCH";
  if (traits.isVisitCandidate) return Number.isFinite(timeMinutes) && timeMinutes < MORNING_END_MINUTES ? "MORNING" : "VISIT";

  return ROUTE_STOP_LABEL_FALLBACK;
}

function sanitizeScheduledStop({
  stop,
  place,
  index,
  totalStops,
  visitDate = null,
  outputLanguage = "ko"
}) {
  if (!stop || !place) {
    return { ...stop, corrected: false };
  }

  const time = typeof stop.time === "string" ? String(stop.time).slice(0, 5) : null;
  const correctedLabel = resolveCompatibleStopLabel({
    label: stop.label,
    place,
    time,
    index,
    totalStops
  });
  const normalizedStoredLabel = normalizeStopLabel(stop.label, index, totalStops);
  const persistedVisitTip = stripLowSignalVisitTip(stop.visitTip);

  if (correctedLabel === normalizedStoredLabel) {
    return {
      ...stop,
      time,
      label: correctedLabel,
      visitTip: persistedVisitTip,
      corrected: persistedVisitTip !== (stop.visitTip || null)
    };
  }
  const generatedCopy = rebuildGeneratedCopy({ ...stop, place, time }, correctedLabel, visitDate, outputLanguage);

  return {
    ...stop,
    time,
    label: correctedLabel,
    reason: generatedCopy.reason,
    visitTip: generatedCopy.visitTip,
    corrected: true
  };
}

function applyLabelCorrection(stop, nextLabel, visitDate, outputLanguage) {
  if (!stop || !nextLabel || stop.label === nextLabel) {
    return stop;
  }

  const generatedCopy = rebuildGeneratedCopy(stop, nextLabel, visitDate, outputLanguage);
  return {
    ...stop,
    label: nextLabel,
    reason: generatedCopy.reason,
    visitTip: generatedCopy.visitTip,
    corrected: true
  };
}

function scoreMealStopForLunch(stops, originalStops, index) {
  const stop = stops[index];
  const traits = getCandidateTraits({ place: stop.place });
  const originalLabel = normalizeStopLabel(originalStops[index]?.label, index, stops.length);
  const timeMinutes = parseTimeToMinutes(stop.time);

  let score = 0;
  if (originalLabel === "LUNCH") score += 100;
  if (originalLabel === "DINNER") score -= 25;
  if (!traits.isDinnerPreferred) score += 8;
  if (Number.isFinite(timeMinutes)) {
    score -= Math.abs(timeMinutes - (12 * 60 + 30)) / 12;
    score += timeMinutes < DINNER_START_MINUTES ? 24 : -28;
  }

  return score;
}

function scoreMealStopForDinner(stops, originalStops, index) {
  const stop = stops[index];
  const traits = getCandidateTraits({ place: stop.place });
  const originalLabel = normalizeStopLabel(originalStops[index]?.label, index, stops.length);
  const timeMinutes = parseTimeToMinutes(stop.time);

  let score = 0;
  if (originalLabel === "DINNER") score += 100;
  if (originalLabel === "LUNCH") score -= 20;
  if (traits.isDinnerPreferred) score += 20;
  if (Number.isFinite(timeMinutes)) {
    score += timeMinutes / 10;
    score += timeMinutes >= DINNER_START_MINUTES ? 24 : -24;
  }

  return score;
}

function pickBestMealIndex(indexes, buildScore) {
  return indexes
    .map((index) => ({ index, score: buildScore(index) }))
    .sort((left, right) => right.score - left.score)[0]?.index;
}

function shouldKeepDinnerSlot(stops, originalStops, mealIndexes) {
  return mealIndexes.some((index) => {
    const stop = stops[index];
    const traits = getCandidateTraits({ place: stop.place });
    const originalLabel = normalizeStopLabel(originalStops[index]?.label, index, stops.length);
    const timeMinutes = parseTimeToMinutes(stop.time);

    return (
      originalLabel === "DINNER" ||
      traits.isDinnerPreferred ||
      (Number.isFinite(timeMinutes) && timeMinutes >= DINNER_START_MINUTES)
    );
  });
}

function resolveOverflowMealLabel(stop) {
  const traits = getCandidateTraits({ place: stop.place });
  const timeMinutes = parseTimeToMinutes(stop.time);

  if (traits.isNight && Number.isFinite(timeMinutes) && timeMinutes >= NIGHT_START_MINUTES) {
    return "NIGHT";
  }

  if (traits.isCafe || traits.isSnack) {
    return Number.isFinite(timeMinutes) && timeMinutes < MORNING_END_MINUTES ? "MORNING" : "DESSERT";
  }

  return null;
}

function rebalanceMealLabels(stops, originalStops, visitDate, outputLanguage) {
  const mealIndexes = stops
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => stop.label === "LUNCH" || stop.label === "DINNER")
    .map(({ index }) => index);

  if (mealIndexes.length === 0) {
    return stops;
  }

  const mealIndexSet = new Set(mealIndexes);
  const keepDinnerIndex = shouldKeepDinnerSlot(stops, originalStops, mealIndexes)
    ? pickBestMealIndex(mealIndexes, (index) => scoreMealStopForDinner(stops, originalStops, index))
    : null;

  const lunchPool = mealIndexes.filter((index) => index !== keepDinnerIndex);
  const keepLunchIndex = pickBestMealIndex(
    lunchPool.length > 0 ? lunchPool : mealIndexes,
    (index) => scoreMealStopForLunch(stops, originalStops, index)
  );

  return stops
    .map((stop, index) => {
    if (!mealIndexSet.has(index)) {
      return stop;
    }

    let nextLabel = stop.label;

    if (index === keepLunchIndex && index === keepDinnerIndex) {
      const timeMinutes = parseTimeToMinutes(stop.time);
      nextLabel = Number.isFinite(timeMinutes) && timeMinutes >= DINNER_START_MINUTES ? "DINNER" : "LUNCH";
    } else if (index === keepLunchIndex) {
      nextLabel = "LUNCH";
    } else if (index === keepDinnerIndex) {
      nextLabel = "DINNER";
    } else {
      nextLabel = resolveOverflowMealLabel(stop);
    }

      return nextLabel ? applyLabelCorrection(stop, nextLabel, visitDate, outputLanguage) : null;
    })
    .filter(Boolean);
}

function scoreActivityStopToKeep(stop, index) {
  const timeMinutes = parseTimeToMinutes(stop?.time);
  let score = 0;

  if (stop?.isMustVisit) score += 120;
  if (stop?.label === "VISIT") score += 16;
  if (stop?.label === "MORNING") score += 10;
  if (Number.isFinite(timeMinutes)) {
    score -= Math.abs(timeMinutes - (14 * 60)) / 15;
  }

  return score - index;
}

function enforceDailyActivityLimit(stops) {
  const activityIndexes = stops
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => getCandidateTraits({ place: stop.place }).isActivity)
    .map(({ index }) => index);

  if (activityIndexes.length <= 1) {
    return stops;
  }

  const keepIndex = activityIndexes
    .map((index) => ({ index, score: scoreActivityStopToKeep(stops[index], index) }))
    .sort((left, right) => right.score - left.score)[0]?.index;

  return stops.filter((_, index) => !activityIndexes.includes(index) || index === keepIndex);
}

function sanitizeScheduledDayStops({ stops, visitDate = null, outputLanguage = "ko" }) {
  const originalStops = Array.isArray(stops) ? stops : [];
  const individuallySanitizedStops = originalStops.map((stop, index, list) =>
    sanitizeScheduledStop({
      stop,
      place: stop.place,
      index,
      totalStops: list.length,
      visitDate,
      outputLanguage
    })
  );

  return enforceDailyActivityLimit(
    rebalanceMealLabels(individuallySanitizedStops, originalStops, visitDate, outputLanguage)
  );
}

module.exports = {
  parseTimeToMinutes,
  resolveCompatibleStopLabel,
  sanitizeScheduledStop,
  sanitizeScheduledDayStops,
  stripLowSignalVisitTip
};
