const { PLACE_CATEGORY, PLACE_CATEGORY_VALUES } = require("./route-taxonomy");
const placeTypeTaxonomy = require("../../../place-type-taxonomy.json");

const CATEGORY_TAG_LIMIT = 2;
const PLACE_CATEGORY_SET = new Set(PLACE_CATEGORY_VALUES);
const PRIMARY_CATEGORY_BY_TYPE = new Map(Object.entries(placeTypeTaxonomy.primaryCategoryByType || {}));
const SECONDARY_CATEGORIES_BY_TYPE = new Map(
  Object.entries(placeTypeTaxonomy.secondaryCategoriesByType || {}).map(([type, categories]) => [
    type,
    (Array.isArray(categories) ? categories : []).filter((category) => PLACE_CATEGORY_SET.has(category))
  ])
);
const BROAD_PRIMARY_TYPE_SET = new Set(placeTypeTaxonomy.broadPrimaryTypes || []);
const CROSS_FAMILY_OVERRIDE_BROAD_TYPE_SET = new Set(placeTypeTaxonomy.crossFamilyOverrideBroadTypes || []);
const BRUNCH_TYPE_SET = new Set(["breakfast_restaurant", "brunch_restaurant"]);
const VIEW_SPOT_TYPE_SET = new Set(["observation_deck", "scenic_spot", "ferris_wheel"]);

function normalizeSignalText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}

function normalizePlaceTypes(types, primaryType = null) {
  return [
    ...new Set(
      [...(Array.isArray(types) ? types : []), primaryType]
        .map((value) => normalizeSignalText(value))
        .filter(Boolean)
    )
  ];
}

function normalizePlaceCategories(values) {
  const source = Array.isArray(values) ? values : values ? [values] : [];
  return [
    ...new Set(
      source
        .map((value) =>
          String(value || "")
            .normalize("NFKC")
            .trim()
            .toUpperCase()
        )
        .filter((value) => PLACE_CATEGORY_SET.has(value))
    )
  ];
}

function getOfficialTypes(types, primaryType = null) {
  return normalizePlaceTypes(types, primaryType).filter((type) => PRIMARY_CATEGORY_BY_TYPE.has(type));
}

function resolveSpecificOverrideType(primaryType, officialTypes) {
  if (!primaryType || !BROAD_PRIMARY_TYPE_SET.has(primaryType)) {
    return null;
  }

  if (!CROSS_FAMILY_OVERRIDE_BROAD_TYPE_SET.has(primaryType)) {
    return null;
  }

  const primaryCategory = PRIMARY_CATEGORY_BY_TYPE.get(primaryType) || null;
  if (!primaryCategory) {
    return null;
  }

  return (
    officialTypes.find((type) => {
      if (type === primaryType) return false;
      if (!PRIMARY_CATEGORY_BY_TYPE.has(type) || BROAD_PRIMARY_TYPE_SET.has(type)) return false;
      return PRIMARY_CATEGORY_BY_TYPE.get(type) !== primaryCategory;
    }) || null
  );
}

function resolvePrimaryCategory({ types, primaryType = null, categories = null }) {
  const normalizedPrimaryType = normalizeSignalText(primaryType);
  const officialTypes = getOfficialTypes(types, normalizedPrimaryType);

  if (normalizedPrimaryType && PRIMARY_CATEGORY_BY_TYPE.has(normalizedPrimaryType)) {
    const overrideType = resolveSpecificOverrideType(normalizedPrimaryType, officialTypes);
    if (overrideType) {
      return PRIMARY_CATEGORY_BY_TYPE.get(overrideType) || null;
    }

    return PRIMARY_CATEGORY_BY_TYPE.get(normalizedPrimaryType) || null;
  }

  const firstSpecificType = officialTypes.find((type) => !BROAD_PRIMARY_TYPE_SET.has(type));
  if (firstSpecificType) {
    return PRIMARY_CATEGORY_BY_TYPE.get(firstSpecificType) || null;
  }

  const firstOfficialType = officialTypes[0] || null;
  if (firstOfficialType) {
    return PRIMARY_CATEGORY_BY_TYPE.get(firstOfficialType) || null;
  }

  return normalizePlaceCategories(categories)[0] || null;
}

function derivePlaceCategories({ types, primaryType = null, categories = null, maxTags = CATEGORY_TAG_LIMIT }) {
  const normalizedPrimaryType = normalizeSignalText(primaryType);
  const officialTypes = getOfficialTypes(types, normalizedPrimaryType);
  const normalizedExistingCategories = normalizePlaceCategories(categories);
  const primaryCategory = resolvePrimaryCategory({
    types: officialTypes,
    primaryType: normalizedPrimaryType,
    categories: normalizedExistingCategories
  });
  const resolved = [];
  const push = (value) => {
    if (!PLACE_CATEGORY_SET.has(value) || resolved.includes(value) || resolved.length >= maxTags) return;
    resolved.push(value);
  };

  push(primaryCategory);

  for (const type of officialTypes) {
    const secondaryCategories = SECONDARY_CATEGORIES_BY_TYPE.get(type) || [];
    for (const category of secondaryCategories) {
      push(category);
    }
  }

  for (const category of normalizedExistingCategories) {
    push(category);
  }

  return resolved;
}

function analyzePlaceSignals({ types, primaryType = null, categories = null }) {
  const normalizedPrimaryType = normalizeSignalText(primaryType);
  const normalizedTypes = normalizePlaceTypes(types, normalizedPrimaryType);
  const resolvedCategories = derivePlaceCategories({
    types: normalizedTypes,
    primaryType: normalizedPrimaryType,
    categories
  });
  const categorySet = new Set(resolvedCategories);
  const typeSet = new Set(normalizedTypes);

  const hasIzakayaType = typeSet.has("japanese_izakaya_restaurant");
  const hasRestaurantSecondaryType = normalizedTypes.some((type) =>
    (SECONDARY_CATEGORIES_BY_TYPE.get(type) || []).includes(PLACE_CATEGORY.RESTAURANT)
  );
  const hasNightDrinkType = categorySet.has(PLACE_CATEGORY.BAR) || categorySet.has(PLACE_CATEGORY.NIGHTLIFE);
  const hasMealType = categorySet.has(PLACE_CATEGORY.RESTAURANT) || hasRestaurantSecondaryType || hasIzakayaType;
  const hasStrongMealType = categorySet.has(PLACE_CATEGORY.RESTAURANT) && !categorySet.has(PLACE_CATEGORY.BAR);
  const isStay = categorySet.has(PLACE_CATEGORY.STAY);
  const isShopping = categorySet.has(PLACE_CATEGORY.SHOP) || categorySet.has(PLACE_CATEGORY.MARKET);
  const isNature = categorySet.has(PLACE_CATEGORY.NATURE);
  const isLandmark = categorySet.has(PLACE_CATEGORY.LANDMARK) || categorySet.has(PLACE_CATEGORY.CULTURE);
  const isActivity = categorySet.has(PLACE_CATEGORY.ACTIVITY);
  const isBrunch = normalizedTypes.some((type) => BRUNCH_TYPE_SET.has(type));
  const isCafe = categorySet.has(PLACE_CATEGORY.CAFE);
  const isSnack = categorySet.has(PLACE_CATEGORY.DESSERT) || categorySet.has(PLACE_CATEGORY.SNACK);
  const isMeal = hasMealType;
  const isViewSpot = normalizedTypes.some((type) => VIEW_SPOT_TYPE_SET.has(type));
  const isNightlife = categorySet.has(PLACE_CATEGORY.NIGHTLIFE) || categorySet.has(PLACE_CATEGORY.BAR);
  const isNight = isNightlife || isViewSpot;

  return {
    normalizedPrimaryType,
    types: normalizedTypes,
    categories: resolvedCategories,
    primaryCategory: resolvedCategories[0] || null,
    hasIzakayaType,
    hasNightDrinkType,
    hasStrongMealType,
    hasMealType,
    isStay,
    isShopping,
    isNature,
    isLandmark,
    isActivity,
    isBrunch,
    isCafe,
    isSnack,
    isMeal,
    isNight,
    isNightlife,
    isViewSpot
  };
}

function deriveScheduleFacets({ types, primaryType = null, categories = null, openingSignals = null }) {
  const signals = analyzePlaceSignals({ types, primaryType, categories });
  const blockedLabels = [];
  const pushBlocked = (label) => {
    if (!blockedLabels.includes(label)) {
      blockedLabels.push(label);
    }
  };

  if (openingSignals?.isKnown) {
    if ((signals.isCafe || signals.isSnack) && !openingSignals.hasDaytimeService) {
      pushBlocked("MORNING");
      pushBlocked("DESSERT");
    }

    if (signals.isMeal && !openingSignals.hasDaytimeService) {
      pushBlocked("LUNCH");
    }
  }

  return {
    categories: signals.categories,
    primaryCategory: signals.primaryCategory,
    isStay: signals.isStay,
    isViewSpot: signals.isViewSpot,
    canVisit: signals.isShopping || signals.isNature || signals.isLandmark || signals.isActivity,
    canMeal: signals.isMeal,
    canCafeBreak: signals.isCafe || signals.isSnack,
    canNight: signals.isNight,
    canShopping: signals.isShopping,
    blockedLabels
  };
}

module.exports = {
  CATEGORY_TAG_LIMIT,
  normalizeSignalText,
  normalizePlaceTypes,
  normalizePlaceCategories,
  derivePlaceCategories,
  analyzePlaceSignals,
  deriveScheduleFacets
};
