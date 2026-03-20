require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { scrapeList } = require("../src/lib/aiCrawler");
const { searchPlacesByText, fetchPlaceDetailsById, normalizePlacePayload } = require("../src/lib/googlePlaces");
const { buildSchedulePlan, filterNonLodgingCandidates } = require("../src/lib/scheduleEngine");
const { sanitizeScheduledDayStops } = require("../src/lib/scheduleStopSanitizer");
const { preprocessCandidatesForSchedule } = require("../src/lib/placeListPreprocessor");

const CITY_ALIAS_GROUPS = [
  ["bangkok", "방콕", "krung thep", "krungthep", "กรุงเทพ", "กรุงเทพมหานคร", "bkk"],
  ["osaka", "오사카", "大阪"],
  ["tokyo", "도쿄", "東京"],
  ["kyoto", "교토", "京都"],
  ["fukuoka", "후쿠오카", "福岡"],
  ["sapporo", "삿포로", "札幌"],
  ["busan", "부산", "釜山", "pusan"],
  ["seoul", "서울", "ソウル"],
  ["jeju", "제주", "濟州", "济州"],
  ["taipei", "타이베이", "臺北", "台北"],
  ["paris", "파리", "巴黎"],
  ["london", "런던", "倫敦"],
  ["new york", "뉴욕", "newyork"],
  ["kaohsiung", "가오슝", "高雄"],
  ["dalat", "달랏", "da lat", "đà lạt"]
];

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(startDate, offset) {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return toDateString(date);
}

function buildTripDays(startDate, dayCount) {
  return Array.from({ length: dayCount }, (_, index) => ({
    day: index + 1,
    date: addDays(startDate, index)
  }));
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/[\s\W_]+/g, "");
}

function getCityAliases(city) {
  const normalized = normalizeText(city);
  const compact = compactText(city);

  for (const group of CITY_ALIAS_GROUPS) {
    const aliases = group.flatMap((alias) => [normalizeText(alias), compactText(alias)]).filter(Boolean);
    if (aliases.includes(normalized) || aliases.includes(compact)) {
      return aliases;
    }
  }

  return [];
}

function includesCityToken(text, cityTokens) {
  if (!text || cityTokens.length === 0) return false;
  const normalized = normalizeText(text);
  const compact = compactText(text);
  return cityTokens.some((token) => normalized.includes(token) || compact.includes(token));
}

function isStayCandidate(candidate) {
  const categories = Array.isArray(candidate?.place?.categories) ? candidate.place.categories : [];
  return categories.includes("STAY");
}

function summarizeCategories(candidates) {
  const counts = new Map();
  for (const candidate of candidates || []) {
    const categories = Array.isArray(candidate?.place?.categories) ? candidate.place.categories : [];
    for (const category of categories) {
      counts.set(category, (counts.get(category) || 0) + 1);
    }
  }
  return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1]));
}

function sanitizePlanDays(planDays, outputLanguage = "ko") {
  const tripDays = Array.isArray(planDays)
    ? planDays.map((day, index) => ({
        day: index + 1,
        date: day?.date || null
      }))
    : [];

  return (planDays || []).map((day, index) => ({
    ...day,
    stops: sanitizeScheduledDayStops({
      stops: day.stops || [],
      visitDate: tripDays[index]?.date || null,
      outputLanguage
    })
  }));
}

async function resolvePlaceFromScrapedItem(item, city) {
  const searchResults = await searchPlacesByText(`${item.name} ${city}`.trim(), 5);
  const cityTokens = getCityAliases(city);
  const resolved = (searchResults || []).find((place) => includesCityToken(place?.formattedAddress, cityTokens)) || searchResults[0];
  if (!resolved?.id) {
    return null;
  }

  const details = await fetchPlaceDetailsById(resolved.id);
  const payload = normalizePlacePayload(details, {
    googlePlaceId: resolved.id,
    name: item.name
  });

  return {
    place: {
      id: payload.google_place_id,
      google_place_id: payload.google_place_id,
      name: payload.name,
      formatted_address: payload.formatted_address,
      lat: payload.lat,
      lng: payload.lng,
      address_components: payload.address_components,
      rating: payload.rating,
      user_rating_count: payload.user_rating_count,
      price_level: payload.price_level,
      types_raw: payload.types_raw,
      primary_type: payload.primary_type,
      business_status: payload.business_status,
      categories: payload.categories,
      google_maps_url: payload.google_maps_url,
      opening_hours: payload.opening_hours
    },
    note: item.note || null,
    isMustVisit: false
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const url = String(args.url || "").trim();
  const city = String(args.city || "").trim();
  const dayCount = Math.max(1, Number.parseInt(String(args.days || "3"), 10) || 3);
  const pace = String(args.pace || "MODERATE").trim().toUpperCase();
  const themes = String(args.themes || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const outputLanguage = String(args.language || "ko").trim().toLowerCase() === "en" ? "en" : "ko";
  const startDate = String(args.startDate || "2026-04-01").trim();
  const outputFile = args["output-file"] ? path.resolve(String(args["output-file"])) : null;

  if (!url || !city) {
    console.error("Usage: node scripts/analyze-place-list-url.js --url <google-maps-url> --city <city> [--days 3] [--pace MODERATE] [--themes FOODIE,LANDMARK]");
    process.exit(1);
  }

  const scrapedPlaces = await scrapeList(url);
  const resolvedCandidates = [];
  const unresolved = [];

  for (const item of scrapedPlaces) {
    try {
      const resolved = await resolvePlaceFromScrapedItem(item, city);
      if (!resolved) {
        unresolved.push({ name: item.name, reason: "unresolved" });
        continue;
      }
      resolvedCandidates.push(resolved);
    } catch (error) {
      unresolved.push({ name: item.name, reason: error.message });
    }
  }

  const stayCandidate = resolvedCandidates.find(isStayCandidate) || null;
  const schedulableCandidates = filterNonLodgingCandidates(resolvedCandidates);
  const candidatePreprocess = preprocessCandidatesForSchedule({
    candidates: schedulableCandidates,
    cityName: city
  });
  const generationInput = {
    startDate,
    endDate: addDays(startDate, dayCount - 1),
    dayCount,
    city,
    companions: null,
    pace,
    themes,
    candidatePreprocess: candidatePreprocess.preprocessing,
    placeListId: "analysis",
    stayPlaceId: stayCandidate?.place?.id || null,
    outputLanguage,
    tripDays: buildTripDays(startDate, dayCount)
  };

  let planDays = buildSchedulePlan({
    candidates: candidatePreprocess.candidates,
    dayCount,
    stayPlace: stayCandidate?.place || null,
    generationInput
  });

  planDays = planDays.map((day, index) => ({
    ...day,
    date: generationInput.tripDays[index]?.date || null
  }));
  planDays = sanitizePlanDays(planDays, outputLanguage);

  const output = {
    request: {
      city,
      url,
      dayCount,
      pace,
      themes,
      outputLanguage,
      startDate
    },
    scrape: {
      scrapedCount: scrapedPlaces.length,
      resolvedCount: resolvedCandidates.length,
      unresolvedCount: unresolved.length,
      unresolved
    },
    candidates: {
      stayCandidate: stayCandidate
        ? {
            id: stayCandidate.place.id,
            name: stayCandidate.place.name,
            categories: stayCandidate.place.categories
          }
        : null,
      schedulableCount: schedulableCandidates.length,
      preprocessedCount: candidatePreprocess.candidates.length,
      excludedOutlierCount: candidatePreprocess.excludedCandidates.length,
      categoryCounts: summarizeCategories(candidatePreprocess.candidates)
    },
    preprocess: {
      ...candidatePreprocess.preprocessing,
      excludedCandidates: candidatePreprocess.excludedCandidates.map((entry) => ({
        placeId: entry.candidate?.place?.id || null,
        name: entry.candidate?.place?.name || null,
        reason: entry.reason,
        countryKey: entry.countryKey,
        countryLabel: entry.countryLabel
      }))
    },
    schedule: planDays.map((day) => ({
      dayNumber: day.dayNumber,
      date: day.date,
      labels: (day.stops || []).map((stop) => stop.label),
      stops: (day.stops || []).map((stop) => {
        const place =
          candidatePreprocess.candidates.find((candidate) => candidate.place.id === stop.placeId)?.place || {};
        return {
          time: stop.time,
          label: stop.label,
          placeId: stop.placeId,
          name: place.name || null,
          categories: place.categories || [],
          primaryType: place.primary_type || null,
          businessStatus: place.business_status || null,
          reason: stop.reason,
          visitTip: stop.visitTip
        };
      })
    }))
  };

  const serialized = JSON.stringify(output, null, 2);
  if (outputFile) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, `${serialized}\n`, "utf8");
  }
  console.log(serialized);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
