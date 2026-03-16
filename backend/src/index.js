require("dotenv").config();

const { createServer } = require("node:http");
const { createSchema, createYoga } = require("graphql-yoga");
const { typeDefs } = require("./schema");
const { resolvers } = require("./resolvers");
const { createSupabaseClient, createSupabasePublicClient } = require("./lib/supabase");

const port = Number(process.env.PORT || 4000);

const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers
  }),
  graphiql: process.env.NODE_ENV !== "production",
  context: ({ request }) => {
    const authHeader = request.headers.get("authorization");

    return {
      supabase: createSupabaseClient(authHeader),
      supabasePublic: createSupabasePublicClient(authHeader),
      authHeader
    };
  }
});

function resolveGooglePlacesApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
}

function isValidPhotoResourceName(name) {
  return typeof name === "string" && /^places\/[^/]+\/photos\/[^/?#]+$/i.test(name);
}

function parseDimension(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(128, Math.min(640, parsed));
}

function parseRouteMapPoints(requestUrl) {
  const rawPoints = requestUrl.searchParams.getAll("point");
  const points = [];

  for (const rawPoint of rawPoints.slice(0, 20)) {
    const [latRaw, lngRaw] = String(rawPoint || "").split(",", 2);
    const lat = Number.parseFloat(latRaw || "");
    const lng = Number.parseFloat(lngRaw || "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    points.push({ lat, lng });
  }

  return points;
}

function toMapMarkerLabel(index) {
  if (index < 9) return String(index + 1);
  const alphabetIndex = (index - 9) % 26;
  return String.fromCharCode(65 + alphabetIndex);
}

async function handlePlacePhotoProxy(req, res, requestUrl) {
  const apiKey = resolveGooglePlacesApiKey();
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Missing GOOGLE_PLACES_API_KEY" }));
    return;
  }

  const resourceName = requestUrl.searchParams.get("name")?.trim() || "";
  if (!isValidPhotoResourceName(resourceName)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Invalid photo resource name" }));
    return;
  }

  const maxWidthRaw = requestUrl.searchParams.get("maxWidthPx");
  const parsedWidth = Number.parseInt(maxWidthRaw || "", 10);
  const maxWidthPx = Number.isFinite(parsedWidth) ? Math.max(64, Math.min(1600, parsedWidth)) : 320;
  const upstreamUrl = `https://places.googleapis.com/v1/${resourceName}/media?maxWidthPx=${maxWidthPx}`;

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey
      }
    });
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Failed to fetch Google place photo", details: String(error?.message || error) }));
    return;
  }

  if (!upstreamResponse.ok) {
    const upstreamText = await upstreamResponse.text();
    res.statusCode = upstreamResponse.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "Google photo request failed",
        status: upstreamResponse.status,
        details: upstreamText
      })
    );
    return;
  }

  const contentType = upstreamResponse.headers.get("content-type") || "image/jpeg";
  const imageBuffer = Buffer.from(await upstreamResponse.arrayBuffer());

  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.end(imageBuffer);
}

async function handleRouteMapProxy(req, res, requestUrl) {
  const apiKey = resolveGooglePlacesApiKey();
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Missing GOOGLE_PLACES_API_KEY" }));
    return;
  }

  const points = parseRouteMapPoints(requestUrl);
  if (points.length === 0) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "At least one valid point is required" }));
    return;
  }

  const width = parseDimension(requestUrl.searchParams.get("width"), 640);
  const height = parseDimension(requestUrl.searchParams.get("height"), 360);

  const params = new URLSearchParams();
  params.set("size", `${width}x${height}`);
  params.set("scale", "2");
  params.set("maptype", "roadmap");
  params.set("key", apiKey);

  if (points.length >= 2) {
    const pathParts = ["color:0x2F7F53CC", "weight:4", "geodesic:true", ...points.map((point) => `${point.lat},${point.lng}`)];
    params.append("path", pathParts.join("|"));
  }

  points.forEach((point, index) => {
    const markerParts = [`color:0x2F7F53`, `label:${toMapMarkerLabel(index)}`, `${point.lat},${point.lng}`];
    params.append("markers", markerParts.join("|"));
  });

  const upstreamUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstreamUrl, { method: "GET" });
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Failed to fetch Google route map", details: String(error?.message || error) }));
    return;
  }

  if (!upstreamResponse.ok) {
    const upstreamText = await upstreamResponse.text();
    res.statusCode = upstreamResponse.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "Google route map request failed",
        status: upstreamResponse.status,
        details: upstreamText
      })
    );
    return;
  }

  const contentType = upstreamResponse.headers.get("content-type") || "image/png";
  const imageBuffer = Buffer.from(await upstreamResponse.arrayBuffer());

  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.end(imageBuffer);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/place-photo") {
    await handlePlacePhotoProxy(req, res, url);
    return;
  }

  if (req.method === "GET" && url.pathname === "/route-map") {
    await handleRouteMapProxy(req, res, url);
    return;
  }

  return yoga(req, res);
});

server.listen(port, () => {
  console.log(`GraphQL server ready at http://localhost:${port}${yoga.graphqlEndpoint}`);
});
