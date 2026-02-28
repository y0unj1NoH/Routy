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

function minutesToTime(minutes) {
  const normalized = Math.max(0, Math.round(minutes));
  const hour = String(Math.floor(normalized / 60) % 24).padStart(2, "0");
  const minute = String(normalized % 60).padStart(2, "0");
  return `${hour}:${minute}`;
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

function distributeCandidates(candidates, dayCount) {
  const normalizedDayCount = Math.max(1, Math.min(dayCount, 30));
  const totalPlaces = candidates.length;
  const baseSize = Math.floor(totalPlaces / normalizedDayCount);
  const remainder = totalPlaces % normalizedDayCount;

  const buckets = [];
  let cursor = 0;

  for (let day = 1; day <= normalizedDayCount; day += 1) {
    const bucketSize = baseSize + (day <= remainder ? 1 : 0);
    buckets.push({
      dayNumber: day,
      candidates: candidates.slice(cursor, cursor + bucketSize)
    });
    cursor += bucketSize;
  }

  return buckets;
}

function inferLandmark(place) {
  if (typeof place.category === "string" && place.category.toUpperCase().includes("LANDMARK")) {
    return true;
  }

  const types = Array.isArray(place.types_raw) ? place.types_raw : [];
  const landmarkTypes = new Set(["tourist_attraction", "museum", "park", "art_gallery", "landmark"]);
  return types.some((type) => landmarkTypes.has(String(type)));
}

function buildBadges(candidate) {
  const badges = [];
  if (candidate.priority) badges.push("MUSTVISIT");
  if (inferLandmark(candidate.place)) badges.push("LANDMARK");
  return badges;
}

function buildReason(candidate, transport) {
  const chunks = [];
  if (candidate.priority) {
    chunks.push("MustVisit 장소라 우선 배치했습니다.");
  } else {
    chunks.push("전체 동선을 고려해 배치했습니다.");
  }

  if (transport?.duration) {
    chunks.push(`다음 이동은 약 ${transport.duration} 예상입니다.`);
  }

  return chunks.join(" ");
}

function buildStopLabel(index, total) {
  if (index === 0) return "START";
  if (index === total - 1) return "FINISH";
  if (index === 1) return "MORNING";
  if (index === total - 2) return "AFTERNOON";
  return "VISIT";
}

function normalizeCandidates(candidates) {
  const deduped = [];
  const byPlaceId = new Map();

  for (const candidate of candidates || []) {
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

function buildSchedulePlan({ candidates, dayCount, stayPlace }) {
  const normalizedCandidates = normalizeCandidates(candidates);
  const prioritized = normalizedCandidates.filter((candidate) => candidate.priority);
  const normal = normalizedCandidates.filter((candidate) => !candidate.priority);
  const ordered = [
    ...orderCandidatesByNearestNeighbor(prioritized, stayPlace),
    ...orderCandidatesByNearestNeighbor(normal, stayPlace)
  ];
  const buckets = distributeCandidates(ordered, dayCount);

  return buckets.map((bucket) => {
    const dayCandidates = bucket.candidates;
    const stops = [];
    let currentMinutes = 9 * 60;

    for (let index = 0; index < dayCandidates.length; index += 1) {
      const candidate = dayCandidates[index];
      const nextCandidate = dayCandidates[index + 1] || null;
      const transport = nextCandidate ? estimateTransport(candidate.place, nextCandidate.place) : null;
      const visitMinutes = candidate.priority ? 120 : 90;

      stops.push({
        placeId: candidate.place.id,
        time: minutesToTime(currentMinutes),
        label: buildStopLabel(index, dayCandidates.length),
        badges: buildBadges(candidate),
        note: candidate.note || null,
        reason: buildReason(candidate, transport),
        transportToNext: transport
          ? {
              mode: transport.mode,
              distance: transport.distance,
              duration: transport.duration
            }
          : null
      });

      currentMinutes += visitMinutes + (transport?.travelMinutes || 0);
    }

    return {
      dayNumber: bucket.dayNumber,
      stops
    };
  });
}

module.exports = {
  buildSchedulePlan
};
