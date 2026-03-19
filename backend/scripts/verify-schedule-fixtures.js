const assert = require("node:assert/strict");
const { buildSchedulePlan, filterNonLodgingCandidates, __internals } = require("../src/lib/scheduleEngine");
const { preprocessCandidatesForSchedule } = require("../src/lib/placeListPreprocessor");

function makeHours(day, openHour, closeHour) {
  return {
    periods: [
      {
        open: { day, hour: openHour, minute: 0 },
        close: { day, hour: closeHour, minute: 0 }
      }
    ],
    weekdayDescriptions: ["fixture"]
  };
}

function makeSplitMealHours(day, lunchOpen, lunchClose, dinnerOpen, dinnerClose) {
  return {
    periods: [
      {
        open: { day, hour: lunchOpen, minute: 0 },
        close: { day, hour: lunchClose, minute: 0 }
      },
      {
        open: { day, hour: dinnerOpen, minute: 0 },
        close: { day, hour: dinnerClose, minute: 0 }
      }
    ],
    weekdayDescriptions: ["fixture"]
  };
}

function buildGenerationInput({ pace = "MODERATE", themes = [], dayCount = 1, tripDays = null } = {}) {
  const normalizedTripDays =
    tripDays ||
    Array.from({ length: dayCount }, (_, index) => ({
      day: index + 1,
      date: `2026-03-${String(19 + index).padStart(2, "0")}`
    }));

  return {
    pace,
    themes,
    outputLanguage: "ko",
    tripDays: normalizedTripDays,
    dayCount
  };
}

function makeAddressComponents({ countryCode, countryName, locality = null }) {
  const components = [];

  if (countryCode || countryName) {
    components.push({
      longText: countryName || countryCode || null,
      shortText: countryCode || countryName || null,
      types: ["country", "political"]
    });
  }

  if (locality) {
    components.push({
      longText: locality,
      shortText: locality,
      types: ["locality", "political"]
    });
  }

  return components;
}

function stopLabelFor(plan, placeId) {
  for (const day of plan) {
    const matchedStop = (day.stops || []).find((stop) => stop.placeId === placeId);
    if (matchedStop) return matchedStop.label;
  }
  return null;
}

function flattenStops(plan) {
  return (Array.isArray(plan) ? plan : []).flatMap((day) => day.stops || []);
}

function stopLabels(plan) {
  return flattenStops(plan).map((stop) => stop.label);
}

function stopPlaceIds(plan) {
  return new Set(flattenStops(plan).map((stop) => stop.placeId));
}

function runTeamlabFixture() {
  const plan = buildSchedulePlan({
    candidates: [
      {
        place: {
          id: "teamlab",
          name: "teamLab Forest Fukuoka",
          categories: ["LANDMARK"],
          primary_type: "tourist_attraction",
          types_raw: ["tourist_attraction", "museum"],
          lat: 33.594,
          lng: 130.41,
          rating: 4.6,
          user_rating_count: 2400,
          opening_hours: makeHours(4, 10, 20)
        },
        isMustVisit: true,
        note: null
      },
      {
        place: {
          id: "lunch",
          name: "Lunch Place",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "ramen_restaurant"],
          lat: 33.593,
          lng: 130.409,
          rating: 4.2,
          user_rating_count: 600,
          opening_hours: makeSplitMealHours(4, 11, 15, 17, 22)
        },
        isMustVisit: false,
        note: null
      },
      {
        place: {
          id: "dinner",
          name: "Dinner Place",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "italian_restaurant"],
          lat: 33.595,
          lng: 130.411,
          rating: 4.4,
          user_rating_count: 750,
          opening_hours: makeHours(4, 17, 22)
        },
        isMustVisit: false,
        note: null
      }
    ],
    dayCount: 1,
    stayPlace: { lat: 33.5935, lng: 130.4095 },
    generationInput: buildGenerationInput({ themes: ["LANDMARK"] })
  });

  assert.notEqual(stopLabelFor(plan, "teamlab"), "DESSERT", "teamLab should never be scheduled as DESSERT");
}

function runIzakayaFixture() {
  const plan = buildSchedulePlan({
    candidates: [
      {
        place: {
          id: "museum",
          name: "Museum",
          categories: ["CULTURE"],
          primary_type: "museum",
          types_raw: ["museum"],
          lat: 33.59,
          lng: 130.4,
          rating: 4.3,
          user_rating_count: 800,
          opening_hours: makeHours(4, 10, 18)
        },
        isMustVisit: false,
        note: null
      },
      {
        place: {
          id: "lunch",
          name: "Lunch Place",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "ramen_restaurant"],
          lat: 33.591,
          lng: 130.401,
          rating: 4.2,
          user_rating_count: 650,
          opening_hours: makeSplitMealHours(4, 11, 15, 17, 22)
        },
        isMustVisit: false,
        note: null
      },
      {
        place: {
          id: "izakaya",
          name: "스시사카바 사시스 텐진점",
          categories: ["BAR", "RESTAURANT"],
          primary_type: "japanese_izakaya_restaurant",
          types_raw: ["restaurant", "japanese_izakaya_restaurant"],
          lat: 33.592,
          lng: 130.402,
          rating: 4.6,
          user_rating_count: 1400,
          opening_hours: makeHours(4, 17, 23)
        },
        isMustVisit: true,
        note: null
      }
    ],
    dayCount: 1,
    stayPlace: { lat: 33.5905, lng: 130.4005 },
    generationInput: buildGenerationInput({ pace: "INTENSE", themes: ["FOODIE"] })
  });

  const label = stopLabelFor(plan, "izakaya");
  assert.ok(label === "DINNER" || label === "NIGHT", `Izakaya should be DINNER or NIGHT, got ${label}`);
}

function runObservationDeckFixture() {
  const plan = buildSchedulePlan({
    candidates: [
      {
        place: {
          id: "museum",
          name: "Museum",
          categories: ["CULTURE"],
          primary_type: "museum",
          types_raw: ["museum"],
          lat: 33.59,
          lng: 130.4,
          rating: 4.6,
          user_rating_count: 1000,
          opening_hours: makeHours(4, 10, 18)
        },
        isMustVisit: false,
        note: null
      },
      {
        place: {
          id: "lunch",
          name: "Lunch",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "ramen_restaurant"],
          lat: 33.5905,
          lng: 130.4015,
          rating: 4.3,
          user_rating_count: 500,
          opening_hours: makeSplitMealHours(4, 11, 15, 17, 22)
        },
        isMustVisit: false,
        note: null
      },
      {
        place: {
          id: "dinner",
          name: "Dinner",
          categories: ["BAR", "RESTAURANT"],
          primary_type: "japanese_izakaya_restaurant",
          types_raw: ["restaurant", "japanese_izakaya_restaurant"],
          lat: 33.592,
          lng: 130.402,
          rating: 4.6,
          user_rating_count: 1200,
          opening_hours: makeHours(4, 17, 23)
        },
        isMustVisit: false,
        note: null
      },
      {
        place: {
          id: "deck",
          name: "Observation Deck",
          categories: ["LANDMARK"],
          primary_type: "observation_deck",
          types_raw: ["observation_deck"],
          lat: 33.5925,
          lng: 130.4025,
          rating: 4.7,
          user_rating_count: 1400,
          opening_hours: makeHours(4, 10, 22)
        },
        isMustVisit: true,
        note: null
      }
    ],
    dayCount: 1,
    stayPlace: { lat: 33.5902, lng: 130.4002 },
    generationInput: buildGenerationInput({ pace: "INTENSE", themes: ["LANDMARK"] })
  });

  assert.equal(stopLabelFor(plan, "deck"), "NIGHT", "Observation deck should be preserved for NIGHT when a night slot exists");
}

function runDayClusterFixture() {
  const clusters = __internals.buildDayClusters({
    candidates: [
      {
        place: {
          id: "museum-a",
          name: "Museum A",
          categories: ["CULTURE"],
          primary_type: "museum",
          types_raw: ["museum"],
          lat: 33.59,
          lng: 130.4,
          rating: 4.6,
          user_rating_count: 1000,
          opening_hours: makeHours(4, 10, 18)
        },
        isMustVisit: true,
        note: null,
        routeIndex: 0
      },
      {
        place: {
          id: "lunch-a",
          name: "Lunch A",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "ramen_restaurant"],
          lat: 33.5905,
          lng: 130.4015,
          rating: 4.3,
          user_rating_count: 500,
          opening_hours: makeSplitMealHours(4, 11, 15, 17, 22)
        },
        isMustVisit: false,
        note: null,
        routeIndex: 1
      },
      {
        place: {
          id: "dinner-a",
          name: "Dinner A",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "italian_restaurant"],
          lat: 33.592,
          lng: 130.402,
          rating: 4.5,
          user_rating_count: 700,
          opening_hours: makeHours(4, 17, 22)
        },
        isMustVisit: false,
        note: null,
        routeIndex: 2
      },
      {
        place: {
          id: "museum-b",
          name: "Museum B",
          categories: ["CULTURE"],
          primary_type: "museum",
          types_raw: ["museum"],
          lat: 33.66,
          lng: 130.45,
          rating: 4.5,
          user_rating_count: 900,
          opening_hours: makeHours(5, 10, 18)
        },
        isMustVisit: true,
        note: null,
        routeIndex: 3
      },
      {
        place: {
          id: "lunch-b",
          name: "Lunch B",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "sushi_restaurant"],
          lat: 33.662,
          lng: 130.452,
          rating: 4.4,
          user_rating_count: 800,
          opening_hours: makeSplitMealHours(5, 11, 15, 17, 22)
        },
        isMustVisit: false,
        note: null,
        routeIndex: 4
      },
      {
        place: {
          id: "dinner-b",
          name: "Dinner B",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "italian_restaurant"],
          lat: 33.663,
          lng: 130.453,
          rating: 4.5,
          user_rating_count: 700,
          opening_hours: makeHours(5, 17, 22)
        },
        isMustVisit: false,
        note: null,
        routeIndex: 5
      }
    ],
    dayCount: 2,
    stayPlace: { lat: 33.5902, lng: 130.4002 },
    generationInput: buildGenerationInput({
      dayCount: 2,
      tripDays: [
        { day: 1, date: "2026-03-19" },
        { day: 2, date: "2026-03-20" }
      ]
    })
  });

  const day1Ids = new Set(clusters[0].candidates.map((candidate) => candidate.place.id));
  const day2Ids = new Set(clusters[1].candidates.map((candidate) => candidate.place.id));

  assert.ok(day1Ids.has("museum-a"), "Day 1 cluster should contain area A must-visit");
  assert.ok(day1Ids.has("lunch-a"), "Day 1 cluster should contain area A lunch");
  assert.ok(day2Ids.has("museum-b"), "Day 2 cluster should contain area B must-visit");
  assert.ok(day2Ids.has("lunch-b"), "Day 2 cluster should contain area B lunch");
}

function runSparseDataFixture() {
  const plan = buildSchedulePlan({
    candidates: [
      {
        place: {
          id: "lunch-only-day",
          name: "Lunch Only Day",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "ramen_restaurant"],
          lat: 33.59,
          lng: 130.4,
          rating: 4.2,
          user_rating_count: 500,
          opening_hours: makeSplitMealHours(4, 11, 15, 17, 22)
        },
        isMustVisit: false,
        note: null
      },
      {
        place: {
          id: "dinner-only-day",
          name: "Dinner Only Day",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "italian_restaurant"],
          lat: 33.591,
          lng: 130.401,
          rating: 4.4,
          user_rating_count: 650,
          opening_hours: makeHours(4, 17, 22)
        },
        isMustVisit: false,
        note: null
      },
      {
        place: {
          id: "single-visit",
          name: "Single Visit",
          categories: ["LANDMARK"],
          primary_type: "tourist_attraction",
          types_raw: ["tourist_attraction"],
          lat: 33.592,
          lng: 130.402,
          rating: 4.5,
          user_rating_count: 700,
          opening_hours: makeHours(4, 10, 18)
        },
        isMustVisit: true,
        note: null
      }
    ],
    dayCount: 2,
    stayPlace: { lat: 33.5902, lng: 130.4002 },
    generationInput: buildGenerationInput({
      pace: "MODERATE",
      dayCount: 2,
      themes: ["LANDMARK"],
      tripDays: [
        { day: 1, date: "2026-03-19" },
        { day: 2, date: "2026-03-20" }
      ]
    })
  });

  const nonEmptyDayCount = plan.filter((day) => (day.stops || []).length > 0).length;
  assert.equal(nonEmptyDayCount, 1, "Sparse input should not force-fill every requested day");
  assert.ok(
    !stopLabels(plan).includes("DESSERT") && !stopLabels(plan).includes("NIGHT"),
    "Sparse input should avoid unsupported dessert/night labels"
  );
}

function runNoDessertWithoutCandidateFixture() {
  const plan = buildSchedulePlan({
    candidates: [
      {
        place: {
          id: "museum-foodie",
          name: "Museum Foodie",
          categories: ["CULTURE"],
          primary_type: "museum",
          types_raw: ["museum"],
          lat: 33.59,
          lng: 130.4,
          rating: 4.6,
          user_rating_count: 1100,
          opening_hours: makeHours(4, 10, 18)
        },
        isMustVisit: true,
        note: null
      },
      {
        place: {
          id: "lunch-foodie",
          name: "Lunch Foodie",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "sushi_restaurant"],
          lat: 33.591,
          lng: 130.401,
          rating: 4.4,
          user_rating_count: 700,
          opening_hours: makeSplitMealHours(4, 11, 15, 17, 22)
        },
        isMustVisit: false,
        note: null
      },
      {
        place: {
          id: "dinner-foodie",
          name: "Dinner Foodie",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "steak_house"],
          lat: 33.592,
          lng: 130.402,
          rating: 4.5,
          user_rating_count: 920,
          opening_hours: makeHours(4, 17, 22)
        },
        isMustVisit: false,
        note: null
      }
    ],
    dayCount: 1,
    stayPlace: { lat: 33.5902, lng: 130.4002 },
    generationInput: buildGenerationInput({
      pace: "INTENSE",
      themes: ["FOODIE"]
    })
  });

  assert.ok(!stopLabels(plan).includes("DESSERT"), "Foodie trip should not create DESSERT without cafe/snack candidates");
}

function runMustVisitCoverageFixture() {
  const plan = buildSchedulePlan({
    candidates: [
      {
        place: {
          id: "visit-a1",
          name: "Visit A1",
          categories: ["LANDMARK"],
          primary_type: "tourist_attraction",
          types_raw: ["tourist_attraction"],
          lat: 33.59,
          lng: 130.4,
          rating: 4.7,
          user_rating_count: 1200,
          opening_hours: makeHours(4, 10, 18)
        },
        isMustVisit: true,
        note: null
      },
      {
        place: {
          id: "visit-a2",
          name: "Visit A2",
          categories: ["CULTURE"],
          primary_type: "museum",
          types_raw: ["museum"],
          lat: 33.591,
          lng: 130.401,
          rating: 4.6,
          user_rating_count: 1000,
          opening_hours: makeHours(4, 10, 18)
        },
        isMustVisit: true,
        note: null
      },
      {
        place: {
          id: "lunch-a",
          name: "Lunch A",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "ramen_restaurant"],
          lat: 33.5905,
          lng: 130.4015,
          rating: 4.3,
          user_rating_count: 640,
          opening_hours: makeSplitMealHours(4, 11, 15, 17, 22)
        },
        isMustVisit: false,
        note: null
      },
      {
        place: {
          id: "dinner-a",
          name: "Dinner A",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "italian_restaurant"],
          lat: 33.592,
          lng: 130.402,
          rating: 4.5,
          user_rating_count: 720,
          opening_hours: makeHours(4, 17, 22)
        },
        isMustVisit: false,
        note: null
      },
      {
        place: {
          id: "visit-b1",
          name: "Visit B1",
          categories: ["LANDMARK"],
          primary_type: "tourist_attraction",
          types_raw: ["tourist_attraction"],
          lat: 33.66,
          lng: 130.45,
          rating: 4.7,
          user_rating_count: 1350,
          opening_hours: makeHours(5, 10, 18)
        },
        isMustVisit: true,
        note: null
      },
      {
        place: {
          id: "visit-b2",
          name: "Visit B2",
          categories: ["CULTURE"],
          primary_type: "museum",
          types_raw: ["museum"],
          lat: 33.661,
          lng: 130.451,
          rating: 4.5,
          user_rating_count: 980,
          opening_hours: makeHours(5, 10, 18)
        },
        isMustVisit: true,
        note: null
      },
      {
        place: {
          id: "lunch-b",
          name: "Lunch B",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "sushi_restaurant"],
          lat: 33.662,
          lng: 130.452,
          rating: 4.4,
          user_rating_count: 800,
          opening_hours: makeSplitMealHours(5, 11, 15, 17, 22)
        },
        isMustVisit: false,
        note: null
      },
      {
        place: {
          id: "dinner-b",
          name: "Dinner B",
          categories: ["RESTAURANT"],
          primary_type: "restaurant",
          types_raw: ["restaurant", "steak_house"],
          lat: 33.663,
          lng: 130.453,
          rating: 4.6,
          user_rating_count: 830,
          opening_hours: makeHours(5, 17, 22)
        },
        isMustVisit: false,
        note: null
      }
    ],
    dayCount: 2,
    stayPlace: { lat: 33.5902, lng: 130.4002 },
    generationInput: buildGenerationInput({
      pace: "INTENSE",
      dayCount: 2,
      themes: ["LANDMARK"],
      tripDays: [
        { day: 1, date: "2026-03-19" },
        { day: 2, date: "2026-03-20" }
      ]
    })
  });

  const includedPlaceIds = stopPlaceIds(plan);
  for (const placeId of ["visit-a1", "visit-a2", "visit-b1", "visit-b2"]) {
    assert.ok(includedPlaceIds.has(placeId), `Must-visit place ${placeId} should be included in the final plan`);
  }
}

function runCrossCountryOutlierFixture() {
  const result = preprocessCandidatesForSchedule({
    cityName: "방콕",
    candidates: [
      {
        place: {
          id: "bangkok-a",
          name: "Bangkok A",
          address_components: makeAddressComponents({
            countryCode: "TH",
            countryName: "Thailand",
            locality: "Bangkok"
          })
        }
      },
      {
        place: {
          id: "bangkok-b",
          name: "Bangkok B",
          address_components: makeAddressComponents({
            countryCode: "TH",
            countryName: "Thailand",
            locality: "Bangkok"
          })
        }
      },
      {
        place: {
          id: "bangkok-c",
          name: "Bangkok C",
          address_components: makeAddressComponents({
            countryCode: "TH",
            countryName: "Thailand",
            locality: "Bangkok"
          })
        }
      },
      {
        place: {
          id: "seoul-x",
          name: "Seoul X",
          address_components: makeAddressComponents({
            countryCode: "KR",
            countryName: "South Korea",
            locality: "Seoul"
          })
        }
      }
    ]
  });

  assert.equal(result.preprocessing.mode, "dominant_country_prune");
  assert.equal(result.candidates.length, 3);
  assert.equal(result.excludedCandidates.length, 1);
  assert.equal(result.excludedCandidates[0]?.candidate?.place?.id, "seoul-x");
}

function runSameCountryNeighborCityFixture() {
  const result = preprocessCandidatesForSchedule({
    cityName: "오사카",
    candidates: [
      {
        place: {
          id: "osaka-a",
          lat: 34.6937,
          lng: 135.5023,
          name: "Osaka A",
          address_components: makeAddressComponents({
            countryCode: "JP",
            countryName: "Japan",
            locality: "Osaka"
          })
        }
      },
      {
        place: {
          id: "osaka-b",
          lat: 34.7025,
          lng: 135.4959,
          name: "Osaka B",
          address_components: makeAddressComponents({
            countryCode: "JP",
            countryName: "Japan",
            locality: "Osaka"
          })
        }
      },
      {
        place: {
          id: "kyoto-a",
          lat: 35.0116,
          lng: 135.7681,
          name: "Kyoto A",
          address_components: makeAddressComponents({
            countryCode: "JP",
            countryName: "Japan",
            locality: "Kyoto"
          })
        }
      },
      {
        place: {
          id: "kyoto-b",
          lat: 35.0211,
          lng: 135.7556,
          name: "Kyoto B",
          address_components: makeAddressComponents({
            countryCode: "JP",
            countryName: "Japan",
            locality: "Kyoto"
          })
        }
      }
    ]
  });

  assert.equal(result.preprocessing.mode, "pass_through");
  assert.equal(result.candidates.length, 4);
  assert.equal(result.excludedCandidates.length, 0);
}

function runSameCountryFarSingletonFixture() {
  const result = preprocessCandidatesForSchedule({
    cityName: "도쿄",
    candidates: [
      {
        place: {
          id: "tokyo-a",
          lat: 35.6764,
          lng: 139.6993,
          name: "Tokyo A",
          address_components: makeAddressComponents({
            countryCode: "JP",
            countryName: "Japan",
            locality: "Tokyo"
          })
        }
      },
      {
        place: {
          id: "tokyo-b",
          lat: 35.6895,
          lng: 139.6917,
          name: "Tokyo B",
          address_components: makeAddressComponents({
            countryCode: "JP",
            countryName: "Japan",
            locality: "Tokyo"
          })
        }
      },
      {
        place: {
          id: "tokyo-c",
          lat: 35.658,
          lng: 139.7016,
          name: "Tokyo C",
          address_components: makeAddressComponents({
            countryCode: "JP",
            countryName: "Japan",
            locality: "Tokyo"
          })
        }
      },
      {
        place: {
          id: "hakata-x",
          lat: 33.5902,
          lng: 130.4017,
          name: "Hakata X",
          address_components: makeAddressComponents({
            countryCode: "JP",
            countryName: "Japan",
            locality: "Fukuoka"
          })
        }
      },
      {
        place: {
          id: "sannomiya-x",
          lat: 34.6947,
          lng: 135.1956,
          name: "Sannomiya X",
          address_components: makeAddressComponents({
            countryCode: "JP",
            countryName: "Japan",
            locality: "Kobe"
          })
        }
      }
    ]
  });

  assert.equal(result.preprocessing.mode, "same_country_far_singleton_prune");
  assert.equal(result.candidates.length, 3);
  assert.deepEqual(
    result.excludedCandidates.map((entry) => entry.candidate?.place?.id).sort(),
    ["hakata-x", "sannomiya-x"],
    "Far singleton places in the same country should be pruned from a dominant city cluster"
  );
}

function runBusinessStatusFilterFixture() {
  const filtered = filterNonLodgingCandidates([
    {
      place: {
        id: "open-restaurant",
        categories: ["RESTAURANT"],
        primary_type: "restaurant",
        types_raw: ["restaurant"],
        business_status: "OPERATIONAL"
      }
    },
    {
      place: {
        id: "closed-temp",
        categories: ["RESTAURANT"],
        primary_type: "restaurant",
        types_raw: ["restaurant"],
        business_status: "CLOSED_TEMPORARILY"
      }
    },
    {
      place: {
        id: "closed-perm",
        categories: ["RESTAURANT"],
        primary_type: "restaurant",
        types_raw: ["restaurant"],
        business_status: "CLOSED_PERMANENTLY"
      }
    }
  ]);

  assert.deepEqual(
    filtered.map((candidate) => candidate.place.id),
    ["open-restaurant"],
    "Temporarily/permanently closed places should not remain in schedulable candidates"
  );
}

function main() {
  runTeamlabFixture();
  runIzakayaFixture();
  runObservationDeckFixture();
  runDayClusterFixture();
  runSparseDataFixture();
  runNoDessertWithoutCandidateFixture();
  runMustVisitCoverageFixture();
  runCrossCountryOutlierFixture();
  runSameCountryNeighborCityFixture();
  runSameCountryFarSingletonFixture();
  runBusinessStatusFilterFixture();
  console.log("schedule fixtures: ok");
}

main();
