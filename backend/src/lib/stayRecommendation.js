const EARTH_RADIUS_KM = 6371;
const MIN_RADIUS_KM = 1.2;
const MAX_RADIUS_KM = 3.0;
const RADIUS_BUFFER_KM = 0.4;
const DISTANCE_PERCENTILE = 0.7;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function normalizeCoordinate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizePoint(point) {
  const lat = normalizeCoordinate(point?.lat);
  const lng = normalizeCoordinate(point?.lng);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function averagePoint(points) {
  if (points.length === 0) return null;
  const totals = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng
    }),
    { lat: 0, lng: 0 }
  );
  return {
    lat: totals.lat / points.length,
    lng: totals.lng / points.length
  };
}

function geometricMedian(points, maxIterations = 32) {
  if (points.length === 0) return null;
  if (points.length === 1) return { ...points[0] };

  let estimate = averagePoint(points);
  if (!estimate) return null;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let weightedLat = 0;
    let weightedLng = 0;
    let weightTotal = 0;
    let coincidentPoint = null;

    for (const point of points) {
      const distance = haversineKm(estimate.lat, estimate.lng, point.lat, point.lng);
      if (distance < 0.0001) {
        coincidentPoint = point;
        break;
      }

      const weight = 1 / distance;
      weightedLat += point.lat * weight;
      weightedLng += point.lng * weight;
      weightTotal += weight;
    }

    if (coincidentPoint) {
      estimate = { ...coincidentPoint };
      break;
    }

    if (weightTotal === 0) {
      break;
    }

    const nextEstimate = {
      lat: weightedLat / weightTotal,
      lng: weightedLng / weightTotal
    };

    const shiftKm = haversineKm(estimate.lat, estimate.lng, nextEstimate.lat, nextEstimate.lng);
    estimate = nextEstimate;
    if (shiftKm < 0.01) {
      break;
    }
  }

  return estimate;
}

function percentile(sortedValues, ratio) {
  if (sortedValues.length === 0) return null;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = clamp((sortedValues.length - 1) * ratio, 0, sortedValues.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sortedValues[lowerIndex];
  const upper = sortedValues[upperIndex];
  if (lowerIndex === upperIndex) return lower;
  const weight = index - lowerIndex;
  return lower + (upper - lower) * weight;
}

function buildDayCenters(planDays, placeById) {
  return (planDays || [])
    .map((day) => {
      const dayPoints = (day?.stops || [])
        .map((stop) => normalizePoint(placeById.get(stop.placeId)))
        .filter(Boolean);
      return geometricMedian(dayPoints);
    })
    .filter(Boolean);
}

function buildStayRecommendation(planDays, placeById) {
  const points = (planDays || [])
    .flatMap((day) => day?.stops || [])
    .map((stop) => normalizePoint(placeById.get(stop.placeId)))
    .filter(Boolean);

  if (points.length === 0) {
    return null;
  }

  const center = geometricMedian(points);
  if (!center) return null;

  const distances = points
    .map((point) => haversineKm(center.lat, center.lng, point.lat, point.lng))
    .sort((left, right) => left - right);

  const percentileDistance = percentile(distances, DISTANCE_PERCENTILE) ?? 0;
  const rawRadiusKm = percentileDistance + RADIUS_BUFFER_KM;
  const radiusKm = clamp(rawRadiusKm, MIN_RADIUS_KM, MAX_RADIUS_KM);
  const outsideRatio =
    distances.length > 0 ? distances.filter((distance) => distance > radiusKm).length / distances.length : 0;

  const dayCenters = buildDayCenters(planDays, placeById);
  let dayCenterSpreadKm = 0;
  for (let index = 0; index < dayCenters.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < dayCenters.length; compareIndex += 1) {
      dayCenterSpreadKm = Math.max(
        dayCenterSpreadKm,
        haversineKm(
          dayCenters[index].lat,
          dayCenters[index].lng,
          dayCenters[compareIndex].lat,
          dayCenters[compareIndex].lng
        )
      );
    }
  }

  return {
    centerLat: Number(center.lat.toFixed(6)),
    centerLng: Number(center.lng.toFixed(6)),
    radiusKm: Number(radiusKm.toFixed(2)),
    wideSpread:
      rawRadiusKm > MAX_RADIUS_KM ||
      outsideRatio >= 0.3 ||
      (dayCenters.length >= 2 && dayCenterSpreadKm > MAX_RADIUS_KM * 1.6)
  };
}

module.exports = {
  buildStayRecommendation
};
