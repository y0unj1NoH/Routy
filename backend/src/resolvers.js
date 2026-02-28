const { GraphQLError } = require("graphql");
const GraphQLJSON = require("graphql-type-json");
const { createSupabaseAdminClient, extractBearerToken } = require("./lib/supabase");
const { buildSchedulePlan } = require("./lib/scheduleEngine");
const { buildGeminiSchedulePlan } = require("./lib/geminiOptimizer");
const { scrapeList } = require("./lib/aiCrawler");
const {
  hasGooglePlacesApiKey,
  resolveGoogleMapsLink,
  fetchPlaceDetailsById,
  normalizePlacePayload
} = require("./lib/googlePlaces");

const TABLES = {
  places: "places",
  placeLists: "place_lists",
  placeListItems: "place_list_items",
  schedules: "schedules",
  scheduleDays: "schedule_days",
  scheduleStops: "schedule_stops"
};

function fail(message, code = "INTERNAL_SERVER_ERROR", details = null) {
  throw new GraphQLError(message, { extensions: { code, details } });
}

function assertSupabase(error, message) {
  if (error) {
    fail(message, "INTERNAL_SERVER_ERROR", error.message);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function normalizeThemes(value) {
  if (!Array.isArray(value)) return [];
  const deduped = new Set();
  for (const theme of value) {
    if (typeof theme !== "string") continue;
    const normalized = theme.trim().toUpperCase();
    if (!normalized) continue;
    deduped.add(normalized);
  }
  return [...deduped];
}

function parseDateStrict(value, fieldName) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`${fieldName} must be YYYY-MM-DD`, "BAD_USER_INPUT");
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    fail(`${fieldName} is invalid`, "BAD_USER_INPUT");
  }

  return date;
}

function computeDayCount(startDate, endDate) {
  const start = parseDateStrict(startDate, "startDate");
  const end = parseDateStrict(endDate, "endDate");
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) {
    fail("endDate must be greater than or equal to startDate", "BAD_USER_INPUT");
  }

  const dayCount = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
  if (dayCount < 1 || dayCount > 30) {
    fail("dayCount must be between 1 and 30", "BAD_USER_INPUT");
  }
  return dayCount;
}

function toDateWithOffset(startDate, offsetDays) {
  const date = parseDateStrict(startDate, "startDate");
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function trimRequired(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    fail(`${fieldName} is required`, "BAD_USER_INPUT");
  }
  return value.trim();
}

function mapUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email || null };
}

function mapAuthPayload(authData) {
  const session = authData?.session || null;
  const user = authData?.user || session?.user || null;
  return {
    accessToken: session?.access_token || null,
    refreshToken: session?.refresh_token || null,
    expiresAt: session?.expires_at || null,
    tokenType: session?.token_type || null,
    user: mapUser(user)
  };
}

function mapPlace(row) {
  if (!row) return null;
  const ratingNumber = row.rating == null ? null : Number(row.rating);
  return {
    id: row.id,
    googlePlaceId: row.google_place_id,
    name: row.name,
    formattedAddress: row.formatted_address,
    lat: row.lat,
    lng: row.lng,
    rating: Number.isNaN(ratingNumber) ? null : ratingNumber,
    userRatingCount: row.user_rating_count,
    priceLevel: row.price_level,
    typesRaw: Array.isArray(row.types_raw) ? row.types_raw : [],
    category: row.category,
    openingHours: row.opening_hours,
    photos: Array.isArray(row.photos) ? row.photos : [],
    reviews: Array.isArray(row.reviews) ? row.reviews : [],
    phone: row.phone,
    website: row.website,
    googleMapsUrl: row.google_maps_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPlaceList(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    city: row.city,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPlaceListItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    listId: row.list_id,
    placeId: row.place_id,
    note: row.note,
    priority: row.priority,
    createdAt: row.created_at
  };
}

function mapSchedule(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    dayCount: row.day_count,
    placeListId: row.place_list_id,
    stayPlaceId: row.stay_place_id,
    companions: row.companions,
    pace: row.pace,
    themes: normalizeThemes(row.themes),
    generationInput: asObject(row.generation_input),
    generationVersion: row.generation_version,
    isManualModified: row.is_manual_modified,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapScheduleDay(row) {
  if (!row) return null;
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    dayNumber: row.day_number,
    date: row.date
  };
}

function mapScheduleStop(row) {
  if (!row) return null;
  return {
    id: row.id,
    scheduleDayId: row.schedule_day_id,
    placeId: row.place_id,
    stopOrder: row.stop_order,
    time: row.time ? String(row.time).slice(0, 5) : null,
    label: row.label,
    badges: Array.isArray(row.badges) ? row.badges : [],
    note: row.note,
    reason: row.reason,
    transportToNext: row.transport_to_next,
    isUserModified: row.is_user_modified
  };
}

async function getOptionalUser(context) {
  if (Object.prototype.hasOwnProperty.call(context, "cachedUser")) {
    return context.cachedUser;
  }

  const token = extractBearerToken(context.authHeader);
  if (!token) {
    context.cachedUser = null;
    return null;
  }

  const { data, error } = await context.supabasePublic.auth.getUser(token);
  if (error) {
    fail("Invalid or expired auth token", "UNAUTHENTICATED", error.message);
  }

  context.cachedUser = data.user || null;
  return context.cachedUser;
}

async function requireUser(context) {
  const user = await getOptionalUser(context);
  if (!user) fail("Authentication required", "UNAUTHENTICATED");
  return user;
}

async function fetchPlaceById(supabase, id) {
  const { data, error } = await supabase.from(TABLES.places).select("*").eq("id", id).maybeSingle();
  assertSupabase(error, "Failed to fetch place");
  return data || null;
}

async function fetchPlaceByGooglePlaceId(supabase, googlePlaceId) {
  const { data, error } = await supabase
    .from(TABLES.places)
    .select("*")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();
  assertSupabase(error, "Failed to fetch place by google_place_id");
  return data || null;
}

async function fetchPlacesByIds(supabase, ids) {
  const deduped = [...new Set(ids || [])];
  if (deduped.length === 0) return [];

  const { data, error } = await supabase.from(TABLES.places).select("*").in("id", deduped);
  assertSupabase(error, "Failed to fetch places");

  const rows = data || [];
  if (rows.length !== deduped.length) {
    const found = new Set(rows.map((row) => row.id));
    const missing = deduped.filter((id) => !found.has(id));
    fail(`Some places were not found: ${missing.join(", ")}`, "BAD_USER_INPUT");
  }

  return rows;
}

async function upsertSharedPlace(supabase, payload) {
  const { data, error } = await supabase
    .from(TABLES.places)
    .upsert(payload, { onConflict: "google_place_id" })
    .select("*")
    .single();

  assertSupabase(error, "Failed to upsert place");
  return data;
}

async function fetchOwnedPlaceList(supabase, userId, listId) {
  const { data, error } = await supabase
    .from(TABLES.placeLists)
    .select("*")
    .eq("user_id", userId)
    .eq("id", listId)
    .maybeSingle();
  assertSupabase(error, "Failed to fetch place list");
  return data || null;
}

async function fetchPlaceListItemById(supabase, id) {
  const { data, error } = await supabase.from(TABLES.placeListItems).select("*").eq("id", id).maybeSingle();
  assertSupabase(error, "Failed to fetch place list item");
  return data || null;
}

async function ensureOwnedPlaceListItem(supabase, userId, itemId) {
  const item = await fetchPlaceListItemById(supabase, itemId);
  if (!item) return null;

  const ownerList = await fetchOwnedPlaceList(supabase, userId, item.list_id);
  if (!ownerList) return null;
  return item;
}

async function fetchOwnedSchedule(supabase, userId, scheduleId) {
  const { data, error } = await supabase
    .from(TABLES.schedules)
    .select("*")
    .eq("user_id", userId)
    .eq("id", scheduleId)
    .maybeSingle();
  assertSupabase(error, "Failed to fetch schedule");
  return data || null;
}

async function fetchPlaceListCandidates(supabase, listId) {
  const { data: itemRows, error: itemError } = await supabase
    .from(TABLES.placeListItems)
    .select("*")
    .eq("list_id", listId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  assertSupabase(itemError, "Failed to fetch place list items");

  const items = itemRows || [];
  if (items.length === 0) {
    return { items: [], candidates: [] };
  }

  const placeIds = items.map((item) => item.place_id);
  const places = await fetchPlacesByIds(supabase, placeIds);
  const byId = new Map(places.map((place) => [place.id, place]));

  const candidates = items
    .map((item) => ({
      place: byId.get(item.place_id),
      note: item.note,
      priority: item.priority
    }))
    .filter((entry) => entry.place);

  return { items, candidates };
}

async function writeScheduleDaysAndStops({ supabase, scheduleId, planDays, startDate, isUserModified = false }) {
  const dayPayload = planDays.map((day) => ({
    schedule_id: scheduleId,
    day_number: day.dayNumber,
    date: toDateWithOffset(startDate, day.dayNumber - 1)
  }));

  const { data: dayRows, error: dayError } = await supabase.from(TABLES.scheduleDays).insert(dayPayload).select("*");
  assertSupabase(dayError, "Failed to create schedule days");

  const dayMap = new Map((dayRows || []).map((row) => [row.day_number, row.id]));
  const stopPayload = [];

  for (const day of planDays) {
    const dayId = dayMap.get(day.dayNumber);
    if (!dayId) fail("Schedule day mapping failed");

    day.stops.forEach((stop, index) => {
      stopPayload.push({
        schedule_day_id: dayId,
        stop_order: index + 1,
        place_id: stop.placeId,
        time: stop.time || null,
        label: stop.label || null,
        badges: Array.isArray(stop.badges) ? stop.badges : [],
        note: stop.note || null,
        reason: stop.reason || null,
        transport_to_next: stop.transportToNext || null,
        is_user_modified: isUserModified
      });
    });
  }

  if (stopPayload.length > 0) {
    const { error: stopError } = await supabase.from(TABLES.scheduleStops).insert(stopPayload);
    assertSupabase(stopError, "Failed to create schedule stops");
  }
}

function buildGenerationInput(payload) {
  return {
    startDate: payload.startDate,
    endDate: payload.endDate,
    companions: payload.companions || null,
    pace: payload.pace || null,
    themes: normalizeThemes(payload.themes),
    placeListId: payload.placeListId,
    stayPlaceId: payload.stayPlaceId || null
  };
}

const resolvers = {
  JSON: GraphQLJSON,

  Query: {
    async health(_, __, context) {
      const { error } = await context.supabase.from(TABLES.places).select("id", { head: true, count: "exact" });
      assertSupabase(error, "Health check failed");
      return { status: "ok", timestamp: new Date().toISOString() };
    },

    async me(_, __, context) {
      return mapUser(await getOptionalUser(context));
    },

    async parseGoogleMapsLink(_, { url }) {
      return resolveGoogleMapsLink(url);
    },

    async places(_, { limit = 100, offset = 0 }, context) {
      await requireUser(context);
      const safeLimit = clamp(limit, 1, 200);
      const safeOffset = Math.max(0, offset);
      const { data, error } = await context.supabase
        .from(TABLES.places)
        .select("*")
        .order("created_at", { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);
      assertSupabase(error, "Failed to fetch places");
      return (data || []).map(mapPlace);
    },

    async place(_, { id }, context) {
      await requireUser(context);
      return mapPlace(await fetchPlaceById(context.supabase, id));
    },

    async placeByGooglePlaceId(_, { googlePlaceId }, context) {
      await requireUser(context);
      return mapPlace(await fetchPlaceByGooglePlaceId(context.supabase, googlePlaceId));
    },

    async myPlaceLists(_, { limit = 50, offset = 0 }, context) {
      const user = await requireUser(context);
      const safeLimit = clamp(limit, 1, 100);
      const safeOffset = Math.max(0, offset);
      const { data, error } = await context.supabase
        .from(TABLES.placeLists)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);
      assertSupabase(error, "Failed to fetch place lists");
      return (data || []).map(mapPlaceList);
    },

    async placeList(_, { id }, context) {
      const user = await requireUser(context);
      return mapPlaceList(await fetchOwnedPlaceList(context.supabase, user.id, id));
    },

    async mySchedules(_, { limit = 20, offset = 0 }, context) {
      const user = await requireUser(context);
      const safeLimit = clamp(limit, 1, 100);
      const safeOffset = Math.max(0, offset);
      const { data, error } = await context.supabase
        .from(TABLES.schedules)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);
      assertSupabase(error, "Failed to fetch schedules");
      return (data || []).map(mapSchedule);
    },

    async schedule(_, { id }, context) {
      const user = await requireUser(context);
      return mapSchedule(await fetchOwnedSchedule(context.supabase, user.id, id));
    }
  },

  Mutation: {
    async signUp(_, { email, password }, context) {
      const { data, error } = await context.supabasePublic.auth.signUp({ email, password });
      assertSupabase(error, "Sign-up failed");
      return mapAuthPayload(data);
    },

    async signIn(_, { email, password }, context) {
      const { data, error } = await context.supabasePublic.auth.signInWithPassword({ email, password });
      assertSupabase(error, "Sign-in failed");
      return mapAuthPayload(data);
    },

    async signInWithGoogle(_, { redirectTo }, context) {
      const finalRedirect = redirectTo || process.env.OAUTH_REDIRECT_TO || undefined;
      const { data, error } = await context.supabasePublic.auth.signInWithOAuth({
        provider: "google",
        options: finalRedirect ? { redirectTo: finalRedirect } : undefined
      });
      assertSupabase(error, "Google OAuth initialization failed");
      return data?.url || "";
    },

    async deleteMyAccount(_, __, context) {
      const user = await requireUser(context);
      const adminClient = createSupabaseAdminClient();
      const { error } = await adminClient.auth.admin.deleteUser(user.id);
      assertSupabase(error, "Account deletion failed");
      return true;
    },

    async importPlaceListFromCrawler(_, { url, listName, city, description }, context) {
      const user = await requireUser(context);
      
      // 1. Scrape the list using Puppeteer
      const scrapedPlaces = await scrapeList(url);
      if (!scrapedPlaces || scrapedPlaces.length === 0) {
        fail("No places found at the provided URL", "BAD_USER_INPUT");
      }

      // 2. Create the PlaceList
      const payload = {
        user_id: user.id,
        name: trimRequired(listName, "listName"),
        city: trimRequired(city, "city"),
        description: description ?? null
      };
      const { data: listRow, error: listError } = await context.supabase.from(TABLES.placeLists).insert(payload).select("*").single();
      assertSupabase(listError, "Failed to create place list");

      // 3. Import Places and get Details via Google Places API / resolveGoogleMapsLink logic
      // Ideally, we search by text for each scraped place to get the ID and details.
      const apiKeyExists = hasGooglePlacesApiKey();
      const placeIdsMap = new Map();

      for (const placeData of scrapedPlaces) {
         try {
           const searchResults = await require('./lib/googlePlaces').searchPlacesByText(placeData.name, 1);
           const resolvedPlaceId = searchResults[0]?.id;
           if (resolvedPlaceId) {
              let placePayload = { google_place_id: resolvedPlaceId };
              if (apiKeyExists) {
                  const details = await fetchPlaceDetailsById(resolvedPlaceId);
                  placePayload = normalizePlacePayload(details, { googlePlaceId: resolvedPlaceId });
              }
              const row = await upsertSharedPlace(context.supabase, placePayload);
              placeIdsMap.set(placeData.name, row.id);

              // 4. Add items to list
              await context.supabase.from(TABLES.placeListItems).upsert(
                {
                  list_id: listRow.id,
                  place_id: row.id,
                  note: placeData.note ?? null,
                  priority: placeData.note ? true : false // user notes mean MUST VISIT
                },
                { onConflict: "list_id,place_id" }
              );
           }
         } catch (e) {
             console.warn(`Could not import place ${placeData.name}`, e);
         }
      }

      return mapPlaceList(listRow);
    },

    async importPlaceFromGoogleLink(_, { url }, context) {
      await requireUser(context);
      const resolved = await resolveGoogleMapsLink(url);
      if (resolved.placeIds.length === 0) return [];

      const rows = [];
      for (const placeId of resolved.placeIds) {
        let payload = {
          google_place_id: placeId,
          google_maps_url: url
        };

        if (hasGooglePlacesApiKey()) {
          try {
            const details = await fetchPlaceDetailsById(placeId);
            payload = normalizePlacePayload(details, { googlePlaceId: placeId, googleMapsUrl: url });
          } catch {
            payload = { ...payload, name: `Imported ${placeId}` };
          }
        }

        rows.push(await upsertSharedPlace(context.supabase, payload));
      }

      return rows.map(mapPlace);
    },

    async upsertPlace(_, { input }, context) {
      await requireUser(context);

      const payload = {
        google_place_id: input.googlePlaceId,
        name: input.name ?? null,
        formatted_address: input.formattedAddress ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        rating: input.rating ?? null,
        user_rating_count: input.userRatingCount ?? null,
        price_level: input.priceLevel ?? null,
        types_raw: Array.isArray(input.typesRaw) ? input.typesRaw : [],
        category: input.category ?? null,
        opening_hours: input.openingHours ?? null,
        photos: Array.isArray(input.photos) ? input.photos : [],
        reviews: Array.isArray(input.reviews) ? input.reviews : [],
        phone: input.phone ?? null,
        website: input.website ?? null,
        google_maps_url: input.googleMapsUrl ?? null
      };

      const row = await upsertSharedPlace(context.supabase, payload);
      return mapPlace(row);
    },

    async refreshPlaceDetails(_, { id }, context) {
      await requireUser(context);
      const existing = await fetchPlaceById(context.supabase, id);
      if (!existing) fail("Place not found", "NOT_FOUND");
      if (!existing.google_place_id) fail("googlePlaceId is missing", "BAD_USER_INPUT");

      const details = await fetchPlaceDetailsById(existing.google_place_id);
      const patch = normalizePlacePayload(details, {
        googlePlaceId: existing.google_place_id,
        name: existing.name,
        formattedAddress: existing.formatted_address,
        lat: existing.lat,
        lng: existing.lng,
        rating: existing.rating,
        userRatingCount: existing.user_rating_count,
        priceLevel: existing.price_level,
        typesRaw: existing.types_raw,
        category: existing.category,
        openingHours: existing.opening_hours,
        photos: existing.photos,
        reviews: existing.reviews,
        phone: existing.phone,
        website: existing.website,
        googleMapsUrl: existing.google_maps_url
      });

      const { data, error } = await context.supabase
        .from(TABLES.places)
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      assertSupabase(error, "Failed to refresh place details");
      return mapPlace(data);
    },

    async createPlaceList(_, { input }, context) {
      const user = await requireUser(context);
      const payload = {
        user_id: user.id,
        name: trimRequired(input.name, "name"),
        city: trimRequired(input.city, "city"),
        description: input.description ?? null
      };

      const { data, error } = await context.supabase.from(TABLES.placeLists).insert(payload).select("*").single();
      assertSupabase(error, "Failed to create place list");
      return mapPlaceList(data);
    },

    async updatePlaceList(_, { id, input }, context) {
      const user = await requireUser(context);
      const existing = await fetchOwnedPlaceList(context.supabase, user.id, id);
      if (!existing) fail("Place list not found", "NOT_FOUND");

      const patch = {};
      if (typeof input.name === "string") patch.name = trimRequired(input.name, "name");
      if (typeof input.city === "string") patch.city = trimRequired(input.city, "city");
      if (Object.prototype.hasOwnProperty.call(input, "description")) patch.description = input.description ?? null;
      if (Object.keys(patch).length === 0) fail("No fields provided for update", "BAD_USER_INPUT");

      const { data, error } = await context.supabase
        .from(TABLES.placeLists)
        .update(patch)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single();
      assertSupabase(error, "Failed to update place list");
      return mapPlaceList(data);
    },

    async deletePlaceList(_, { id }, context) {
      const user = await requireUser(context);
      const { data, error } = await context.supabase
        .from(TABLES.placeLists)
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      assertSupabase(error, "Failed to delete place list");
      return Boolean(data?.id);
    },

    async addPlaceListItem(_, { input }, context) {
      const user = await requireUser(context);
      const list = await fetchOwnedPlaceList(context.supabase, user.id, input.listId);
      if (!list) fail("Place list not found", "NOT_FOUND");

      const place = await fetchPlaceById(context.supabase, input.placeId);
      if (!place) fail("Place not found", "NOT_FOUND");

      const { error } = await context.supabase.from(TABLES.placeListItems).upsert(
        {
          list_id: input.listId,
          place_id: input.placeId,
          note: input.note ?? null,
          priority: Boolean(input.priority)
        },
        { onConflict: "list_id,place_id" }
      );
      assertSupabase(error, "Failed to add place to list");

      return mapPlaceList(await fetchOwnedPlaceList(context.supabase, user.id, input.listId));
    },

    async updatePlaceListItem(_, { id, input }, context) {
      const user = await requireUser(context);
      const existing = await ensureOwnedPlaceListItem(context.supabase, user.id, id);
      if (!existing) fail("Place list item not found", "NOT_FOUND");

      const patch = {};
      if (Object.prototype.hasOwnProperty.call(input, "note")) patch.note = input.note ?? null;
      if (Object.prototype.hasOwnProperty.call(input, "priority")) patch.priority = Boolean(input.priority);
      if (Object.keys(patch).length === 0) fail("No fields provided for update", "BAD_USER_INPUT");

      const { data, error } = await context.supabase
        .from(TABLES.placeListItems)
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      assertSupabase(error, "Failed to update place list item");
      return mapPlaceListItem(data);
    },

    async removePlaceListItem(_, { id }, context) {
      const user = await requireUser(context);
      const existing = await ensureOwnedPlaceListItem(context.supabase, user.id, id);
      if (!existing) fail("Place list item not found", "NOT_FOUND");

      const { data, error } = await context.supabase
        .from(TABLES.placeListItems)
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();
      assertSupabase(error, "Failed to remove place list item");
      return Boolean(data?.id);
    },

    async createSchedule(_, { input }, context) {
      const user = await requireUser(context);
      const list = await fetchOwnedPlaceList(context.supabase, user.id, input.placeListId);
      if (!list) fail("placeListId is invalid", "BAD_USER_INPUT");

      const startDate = input.startDate;
      const endDate = input.endDate;
      const dayCount = computeDayCount(startDate, endDate);
      const themes = normalizeThemes(input.themes);

      const { candidates } = await fetchPlaceListCandidates(context.supabase, list.id);
      if (candidates.length === 0) {
        fail("Selected place list has no places", "BAD_USER_INPUT");
      }

      let stayPlace = null;
      if (input.stayPlaceId) {
        stayPlace = await fetchPlaceById(context.supabase, input.stayPlaceId);
        if (!stayPlace) fail("stayPlaceId is invalid", "BAD_USER_INPUT");
      }

      const generationInput = buildGenerationInput({
        startDate,
        endDate,
        companions: input.companions,
        pace: input.pace,
        themes,
        placeListId: list.id,
        stayPlaceId: input.stayPlaceId
      });

      const planDays = await buildGeminiSchedulePlan({ 
        candidates, 
        dayCount, 
        startDate,
        stayPlace, 
        generationInput, 
        scenario: 'Personalized' 
      });

      const { data: scheduleRow, error: scheduleError } = await context.supabase
        .from(TABLES.schedules)
        .insert({
          user_id: user.id,
          title: trimRequired(input.title, "title"),
          start_date: startDate,
          end_date: endDate,
          day_count: dayCount,
          place_list_id: list.id,
          stay_place_id: input.stayPlaceId ?? null,
          companions: input.companions ?? null,
          pace: input.pace ?? null,
          themes,
          generation_input: generationInput,
          generation_version: "mvp_v1",
          is_manual_modified: false
        })
        .select("*")
        .single();
      assertSupabase(scheduleError, "Failed to create schedule");

      await writeScheduleDaysAndStops({
        supabase: context.supabase,
        scheduleId: scheduleRow.id,
        planDays,
        startDate
      });

      return mapSchedule(scheduleRow);
    },

    async regenerateSchedule(_, { scheduleId, input }, context) {
      const user = await requireUser(context);
      const existing = await fetchOwnedSchedule(context.supabase, user.id, scheduleId);
      if (!existing) fail("Schedule not found", "NOT_FOUND");

      const startDate = input.startDate || existing.start_date;
      const endDate = input.endDate || existing.end_date;
      if (!startDate || !endDate) {
        fail("startDate and endDate are required for regeneration", "BAD_USER_INPUT");
      }

      const dayCount = computeDayCount(startDate, endDate);
      const placeListId = input.placeListId || existing.place_list_id;
      if (!placeListId) {
        fail("placeListId is missing", "BAD_USER_INPUT");
      }

      const list = await fetchOwnedPlaceList(context.supabase, user.id, placeListId);
      if (!list) fail("placeListId is invalid", "BAD_USER_INPUT");

      const themes = Object.prototype.hasOwnProperty.call(input, "themes")
        ? normalizeThemes(input.themes)
        : normalizeThemes(existing.themes);
      const companions = Object.prototype.hasOwnProperty.call(input, "companions")
        ? input.companions
        : existing.companions;
      const pace = Object.prototype.hasOwnProperty.call(input, "pace") ? input.pace : existing.pace;
      const stayPlaceId = Object.prototype.hasOwnProperty.call(input, "stayPlaceId")
        ? input.stayPlaceId
        : existing.stay_place_id;

      let stayPlace = null;
      if (stayPlaceId) {
        stayPlace = await fetchPlaceById(context.supabase, stayPlaceId);
        if (!stayPlace) fail("stayPlaceId is invalid", "BAD_USER_INPUT");
      }

      const { candidates } = await fetchPlaceListCandidates(context.supabase, list.id);
      if (candidates.length === 0) {
        fail("Selected place list has no places", "BAD_USER_INPUT");
      }

      const planDays = buildSchedulePlan({ candidates, dayCount, stayPlace });
      const generationInput = buildGenerationInput({
        startDate,
        endDate,
        companions,
        pace,
        themes,
        placeListId: list.id,
        stayPlaceId
      });

      const { data: updatedSchedule, error: updateError } = await context.supabase
        .from(TABLES.schedules)
        .update({
          title: trimRequired(existing.title, "title"),
          start_date: startDate,
          end_date: endDate,
          day_count: dayCount,
          place_list_id: list.id,
          stay_place_id: stayPlaceId ?? null,
          companions: companions ?? null,
          pace: pace ?? null,
          themes,
          generation_input: generationInput,
          generation_version: "mvp_v1",
          is_manual_modified: false
        })
        .eq("id", scheduleId)
        .eq("user_id", user.id)
        .select("*")
        .single();
      assertSupabase(updateError, "Failed to update schedule");

      const { error: deleteDaysError } = await context.supabase
        .from(TABLES.scheduleDays)
        .delete()
        .eq("schedule_id", scheduleId);
      assertSupabase(deleteDaysError, "Failed to reset schedule days");

      await writeScheduleDaysAndStops({
        supabase: context.supabase,
        scheduleId,
        planDays,
        startDate
      });

      return mapSchedule(updatedSchedule);
    },

    async moveScheduleStop(_, { scheduleId, input }, context) {
      const user = await requireUser(context);
      const schedule = await fetchOwnedSchedule(context.supabase, user.id, scheduleId);
      if (!schedule) fail("Schedule not found", "NOT_FOUND");

      const { data: dayRows, error: dayError } = await context.supabase
        .from(TABLES.scheduleDays)
        .select("id,day_number")
        .eq("schedule_id", scheduleId)
        .order("day_number", { ascending: true });
      assertSupabase(dayError, "Failed to fetch schedule days");

      const targetDay = (dayRows || []).find((row) => row.day_number === input.targetDayNumber);
      if (!targetDay) fail("targetDayNumber is invalid", "BAD_USER_INPUT");

      const dayIds = (dayRows || []).map((row) => row.id);
      const { data: stopRows, error: stopError } = await context.supabase
        .from(TABLES.scheduleStops)
        .select("*")
        .in("schedule_day_id", dayIds)
        .order("stop_order", { ascending: true });
      assertSupabase(stopError, "Failed to fetch schedule stops");

      const movingStop = (stopRows || []).find((row) => row.id === input.stopId);
      if (!movingStop) fail("stopId is invalid", "BAD_USER_INPUT");

      const byDay = new Map(dayIds.map((id) => [id, []]));
      for (const row of stopRows || []) {
        byDay.get(row.schedule_day_id).push(row);
      }

      const source = [...byDay.get(movingStop.schedule_day_id)];
      const target = movingStop.schedule_day_id === targetDay.id ? source : [...byDay.get(targetDay.id)];

      const sourceIndex = source.findIndex((row) => row.id === movingStop.id);
      source.splice(sourceIndex, 1);

      const insertIndex = clamp(input.targetOrder - 1, 0, target.length);
      target.splice(insertIndex, 0, movingStop);

      const plans =
        movingStop.schedule_day_id === targetDay.id
          ? [{ dayId: targetDay.id, rows: target }]
          : [
              { dayId: movingStop.schedule_day_id, rows: source },
              { dayId: targetDay.id, rows: target }
            ];

      for (const plan of plans) {
        for (let index = 0; index < plan.rows.length; index += 1) {
          const row = plan.rows[index];
          const { error } = await context.supabase
            .from(TABLES.scheduleStops)
            .update({
              schedule_day_id: plan.dayId,
              stop_order: index + 1,
              is_user_modified: true
            })
            .eq("id", row.id);
          assertSupabase(error, "Failed to reorder schedule stops");
        }
      }

      const { error: scheduleError } = await context.supabase
        .from(TABLES.schedules)
        .update({ is_manual_modified: true })
        .eq("id", scheduleId)
        .eq("user_id", user.id);
      assertSupabase(scheduleError, "Failed to update manual state");

      return mapSchedule(await fetchOwnedSchedule(context.supabase, user.id, scheduleId));
    },

    async deleteSchedule(_, { id }, context) {
      const user = await requireUser(context);
      const { data, error } = await context.supabase
        .from(TABLES.schedules)
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      assertSupabase(error, "Failed to delete schedule");
      return Boolean(data?.id);
    }
  },

  PlaceList: {
    async itemCount(list, _, context) {
      const { count, error } = await context.supabase
        .from(TABLES.placeListItems)
        .select("id", { head: true, count: "exact" })
        .eq("list_id", list.id);
      assertSupabase(error, "Failed to count place list items");
      return count || 0;
    },

    async items(list, _, context) {
      const { data, error } = await context.supabase
        .from(TABLES.placeListItems)
        .select("*")
        .eq("list_id", list.id)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });
      assertSupabase(error, "Failed to fetch place list items");
      return (data || []).map(mapPlaceListItem);
    }
  },

  PlaceListItem: {
    async place(item, _, context) {
      const row = await fetchPlaceById(context.supabase, item.placeId);
      if (!row) fail("Place not found", "NOT_FOUND");
      return mapPlace(row);
    }
  },

  Schedule: {
    async placeList(schedule, _, context) {
      const row = await fetchOwnedPlaceList(context.supabase, schedule.userId, schedule.placeListId);
      if (!row) fail("Place list not found", "NOT_FOUND");
      return mapPlaceList(row);
    },

    async stayPlace(schedule, _, context) {
      if (!schedule.stayPlaceId) return null;
      return mapPlace(await fetchPlaceById(context.supabase, schedule.stayPlaceId));
    },

    async days(schedule, _, context) {
      const { data, error } = await context.supabase
        .from(TABLES.scheduleDays)
        .select("*")
        .eq("schedule_id", schedule.id)
        .order("day_number", { ascending: true });
      assertSupabase(error, "Failed to fetch schedule days");
      return (data || []).map(mapScheduleDay);
    }
  },

  ScheduleDay: {
    async stops(day, _, context) {
      const { data, error } = await context.supabase
        .from(TABLES.scheduleStops)
        .select("*")
        .eq("schedule_day_id", day.id)
        .order("stop_order", { ascending: true });
      assertSupabase(error, "Failed to fetch schedule stops");
      return (data || []).map(mapScheduleStop);
    }
  },

  ScheduleStop: {
    async place(stop, _, context) {
      const row = await fetchPlaceById(context.supabase, stop.placeId);
      if (!row) fail("Place not found", "NOT_FOUND");
      return mapPlace(row);
    }
  }
};

module.exports = { resolvers };
