"use strict";

const DOMINANT_COUNTRY_MIN_COUNT = 3;
const DOMINANT_COUNTRY_MIN_SHARE = 0.75;
const FAR_OUTLIER_MIN_DISTANCE_KM = 120;
const FAR_OUTLIER_NEIGHBOR_RADIUS_KM = 45;
const FAR_OUTLIER_MIN_CLUSTER_SIZE = 2;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAddressComponents(rawAddressComponents) {
  if (!Array.isArray(rawAddressComponents)) return [];

  return rawAddressComponents
    .map((component) => {
      const longText = typeof component?.longText === "string" ? component.longText.trim() : "";
      const shortText = typeof component?.shortText === "string" ? component.shortText.trim() : "";
      const types = Array.isArray(component?.types)
        ? [...new Set(component.types.map((type) => String(type || "").trim()).filter(Boolean))]
        : [];

      if (!longText && !shortText && types.length === 0) {
        return null;
      }

      return {
        longText: longText || null,
        shortText: shortText || null,
        types
      };
    })
    .filter(Boolean);
}

function findAddressComponent(addressComponents, type) {
  return (addressComponents || []).find((component) => component.types.includes(type)) || null;
}

function extractCountryInfo(addressComponents) {
  const countryComponent = findAddressComponent(addressComponents, "country");
  if (!countryComponent) {
    return {
      key: null,
      label: null
    };
  }

  return {
    key: normalizeText(countryComponent.shortText || countryComponent.longText),
    label: countryComponent.longText || countryComponent.shortText || null
  };
}

function buildCandidateGeoProfile(candidate) {
  const place = candidate?.place || {};
  const addressComponents = normalizeAddressComponents(place.address_components || place.addressComponents);
  const country = extractCountryInfo(addressComponents);
  const lat = Number(place.lat);
  const lng = Number(place.lng);

  return {
    candidate,
    addressComponents,
    countryKey: country.key,
    countryLabel: country.label,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null
  };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deriveDominantCountry(profiles) {
  const withCountry = (profiles || []).filter((profile) => profile.countryKey);
  if (withCountry.length === 0) {
    return null;
  }

  const counts = new Map();
  const labels = new Map();
  for (const profile of withCountry) {
    counts.set(profile.countryKey, (counts.get(profile.countryKey) || 0) + 1);
    if (!labels.has(profile.countryKey) && profile.countryLabel) {
      labels.set(profile.countryKey, profile.countryLabel);
    }
  }

  const [key, count] =
    [...counts.entries()].sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })[0] || [];

  if (!key || !count) {
    return null;
  }

  const share = count / withCountry.length;
  return {
    key,
    label: labels.get(key) || key,
    count,
    share,
    totalWithCountry: withCountry.length,
    isStrong: count >= DOMINANT_COUNTRY_MIN_COUNT && share >= DOMINANT_COUNTRY_MIN_SHARE
  };
}

function deriveDominantCountryCentroid(profiles, dominantCountry) {
  if (!dominantCountry?.key) {
    return null;
  }

  const sameCountryProfiles = (profiles || []).filter(
    (profile) =>
      profile.countryKey === dominantCountry.key &&
      Number.isFinite(profile.lat) &&
      Number.isFinite(profile.lng)
  );

  if (sameCountryProfiles.length < DOMINANT_COUNTRY_MIN_COUNT) {
    return null;
  }

  const sums = sameCountryProfiles.reduce(
    (acc, profile) => {
      acc.lat += profile.lat;
      acc.lng += profile.lng;
      return acc;
    },
    { lat: 0, lng: 0 }
  );

  return {
    lat: sums.lat / sameCountryProfiles.length,
    lng: sums.lng / sameCountryProfiles.length,
    count: sameCountryProfiles.length
  };
}

function findFarSingletonProfiles(profiles, dominantCountry, dominantCentroid) {
  if (!dominantCountry?.key || !dominantCentroid) {
    return [];
  }

  const sameCountryProfiles = (profiles || []).filter(
    (profile) =>
      profile.countryKey === dominantCountry.key &&
      Number.isFinite(profile.lat) &&
      Number.isFinite(profile.lng)
  );

  return sameCountryProfiles.filter((profile) => {
    const distanceFromDominantKm = haversineKm(
      dominantCentroid.lat,
      dominantCentroid.lng,
      profile.lat,
      profile.lng
    );

    if (distanceFromDominantKm <= FAR_OUTLIER_MIN_DISTANCE_KM) {
      return false;
    }

    const nearbyClusterSize = sameCountryProfiles.filter((peer) => {
      if (peer.candidate?.place?.id === profile.candidate?.place?.id) {
        return true;
      }

      return (
        haversineKm(profile.lat, profile.lng, peer.lat, peer.lng) <= FAR_OUTLIER_NEIGHBOR_RADIUS_KM
      );
    }).length;

    return nearbyClusterSize < FAR_OUTLIER_MIN_CLUSTER_SIZE;
  });
}

function preprocessCandidatesForSchedule({ candidates, cityName = null } = {}) {
  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  const profiles = safeCandidates.map(buildCandidateGeoProfile);
  const dominantCountry = deriveDominantCountry(profiles);
  const dominantCentroid = deriveDominantCountryCentroid(profiles, dominantCountry);

  const baseSummary = {
    cityName: cityName || null,
    totalCandidateCount: safeCandidates.length,
    knownCountryCount: profiles.filter((profile) => profile.countryKey).length,
    retainedCount: safeCandidates.length,
    excludedCount: 0,
    dominantCountry: dominantCountry
      ? {
          key: dominantCountry.key,
          label: dominantCountry.label,
          count: dominantCountry.count,
          share: Number(dominantCountry.share.toFixed(4))
        }
      : null,
    dominantCentroid: dominantCentroid
      ? {
          lat: Number(dominantCentroid.lat.toFixed(6)),
          lng: Number(dominantCentroid.lng.toFixed(6)),
          count: dominantCentroid.count
        }
      : null
  };

  if (!dominantCountry) {
    return {
      candidates: safeCandidates,
      excludedCandidates: [],
      preprocessing: {
        ...baseSummary,
        mode: "pass_through",
        reason: "missing_country_components"
      }
    };
  }

  if (!dominantCountry.isStrong) {
    return {
      candidates: safeCandidates,
      excludedCandidates: [],
      preprocessing: {
        ...baseSummary,
        mode: "pass_through",
        reason: "dominant_country_not_strong_enough"
      }
    };
  }

  const retainedCandidates = [];
  const excludedCandidates = [];
  const farSingletonProfiles = findFarSingletonProfiles(profiles, dominantCountry, dominantCentroid);
  const farSingletonIds = new Set(
    farSingletonProfiles.map((profile) => profile.candidate?.place?.id).filter(Boolean)
  );

  for (const profile of profiles) {
    if (profile.countryKey && profile.countryKey !== dominantCountry.key) {
      excludedCandidates.push({
        candidate: profile.candidate,
        reason: "country_mismatch",
        countryKey: profile.countryKey,
        countryLabel: profile.countryLabel
      });
      continue;
    }

    if (farSingletonIds.has(profile.candidate?.place?.id)) {
      excludedCandidates.push({
        candidate: profile.candidate,
        reason: "same_country_far_singleton",
        countryKey: profile.countryKey,
        countryLabel: profile.countryLabel
      });
      continue;
    }

    retainedCandidates.push(profile.candidate);
  }

  if (excludedCandidates.length === 0) {
    return {
      candidates: safeCandidates,
      excludedCandidates: [],
      preprocessing: {
        ...baseSummary,
        mode: "pass_through",
        reason: "no_detected_outliers"
      }
    };
  }

  const excludedReasonSet = new Set(excludedCandidates.map((entry) => entry.reason));
  const removedCrossCountry = excludedReasonSet.has("country_mismatch");
  const removedFarSingleton = excludedReasonSet.has("same_country_far_singleton");

  return {
    candidates: retainedCandidates,
    excludedCandidates,
    preprocessing: {
      ...baseSummary,
      retainedCount: retainedCandidates.length,
      excludedCount: excludedCandidates.length,
      mode:
        removedCrossCountry && removedFarSingleton
          ? "dominant_country_and_far_singleton_prune"
          : removedFarSingleton
            ? "same_country_far_singleton_prune"
            : "dominant_country_prune",
      reason:
        removedCrossCountry && removedFarSingleton
          ? "cross_country_and_far_singleton_outliers_removed"
          : removedFarSingleton
            ? "same_country_far_singletons_removed"
            : "cross_country_outliers_removed"
    }
  };
}

module.exports = {
  preprocessCandidatesForSchedule,
  normalizeAddressComponents,
  __internals: {
    buildCandidateGeoProfile,
    deriveDominantCountry,
    deriveDominantCountryCentroid,
    findFarSingletonProfiles,
    haversineKm
  }
};
