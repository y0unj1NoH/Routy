require("dotenv").config();

const { createServer } = require("node:http");
const { networkInterfaces } = require("node:os");
const { createSchema, createYoga, maskError } = require("graphql-yoga");
const { typeDefs } = require("./schema");
const { resolvers } = require("./resolvers");
const { createSupabaseClient, createSupabasePublicClient } = require("./lib/supabase");
const { parsePort, parseHost, getGooglePlacesApiKey, getTrimmedEnv } = require("./lib/env");
const { takeRateLimit, getRetryAfterSeconds } = require("./lib/rateLimit");
const {
  initSentry,
  captureBackendException,
  setGraphqlRequestScope,
  withSentryRequestIsolation
} = require("./lib/sentry");

const port = parsePort();
const host = parseHost();
const HTTP_RATE_LIMITS = {
  placePhoto: {
    bucket: "http:place-photo",
    limit: 120,
    windowMs: 60 * 1000
  },
  routeMap: {
    bucket: "http:route-map",
    limit: 60,
    windowMs: 60 * 1000
  }
};

initSentry();

const INTERNAL_CLIENT_IP_HEADER = "x-routy-client-ip";

function isWildcardHost(value) {
  return !value || value === "0.0.0.0" || value === "::";
}

function isLoopbackHost(value) {
  return value === "localhost" || value === "127.0.0.1" || value === "::1";
}

function formatUrlHost(value) {
  if (value.includes(":") && !(value.startsWith("[") && value.endsWith("]"))) {
    return `[${value}]`;
  }

  return value;
}

function buildServerUrl(value, portNumber, endpointPath) {
  return `http://${formatUrlHost(value)}:${portNumber}${endpointPath}`;
}

function collectNetworkHosts() {
  const hosts = [];
  const seen = new Set();
  const interfaces = networkInterfaces();

  for (const interfaceAddresses of Object.values(interfaces)) {
    for (const addressInfo of interfaceAddresses || []) {
      if (!addressInfo || addressInfo.internal) {
        continue;
      }

      if (addressInfo.family !== "IPv4" && addressInfo.family !== 4) {
        continue;
      }

      const normalizedAddress = normalizeRemoteAddress(addressInfo.address);
      if (!normalizedAddress || normalizedAddress === "unknown" || seen.has(normalizedAddress)) {
        continue;
      }

      seen.add(normalizedAddress);
      hosts.push(normalizedAddress);
    }
  }

  return hosts;
}

function resolveServerUrls(value, portNumber, endpointPath) {
  const urls = [];
  const seen = new Set();

  function addUrl(hostname) {
    if (!hostname) {
      return;
    }

    const url = buildServerUrl(hostname, portNumber, endpointPath);
    if (seen.has(url)) {
      return;
    }

    seen.add(url);
    urls.push(url);
  }

  if (isWildcardHost(value)) {
    addUrl("localhost");
    collectNetworkHosts().forEach(addUrl);
    return urls;
  }

  if (isLoopbackHost(value)) {
    addUrl("localhost");
  }

  addUrl(value);
  return urls;
}

function logServerReady(value, portNumber, endpointPath) {
  const bindLabel = value || "(node default)";
  const urls = resolveServerUrls(value, portNumber, endpointPath);

  console.log(`GraphQL server ready (bind ${bindLabel}:${portNumber})`);
  urls.forEach((url) => {
    console.log(`- ${url}`);
  });
}

function normalizeRemoteAddress(remoteAddress) {
  const normalized = String(remoteAddress || "").trim();
  if (!normalized) {
    return "unknown";
  }

  if (normalized.startsWith("::ffff:")) {
    return normalized.slice(7);
  }

  if (normalized === "::1") {
    return "127.0.0.1";
  }

  return normalized;
}

function resolveClientIpFromRequest(req) {
  const internalClientIp = req.headers[INTERNAL_CLIENT_IP_HEADER];
  if (typeof internalClientIp === "string" && internalClientIp.trim()) {
    return internalClientIp.trim();
  }

  // Use the socket address by default so callers cannot spoof rate-limit identity
  // through forwarded headers unless the server explicitly re-injects a trusted value.
  return normalizeRemoteAddress(req.socket?.remoteAddress);
}

function setInternalClientIpHeader(req, clientIp) {
  req.headers[INTERNAL_CLIENT_IP_HEADER] = clientIp;
}

function resolveClientIpFromHeaders(headers) {
  const internalClientIp = headers.get(INTERNAL_CLIENT_IP_HEADER)?.trim();
  if (internalClientIp) {
    return internalClientIp;
  }

  return "unknown";
}

function applyHttpRateLimit(res, config, clientIp) {
  const result = takeRateLimit({
    ...config,
    identifier: clientIp
  });

  res.setHeader("X-RateLimit-Limit", String(result.limit));
  res.setHeader("X-RateLimit-Remaining", String(result.remaining));
  res.setHeader("X-RateLimit-Reset", String(result.resetAt));

  if (result.allowed) {
    return true;
  }

  const retryAfterSeconds = getRetryAfterSeconds(result);
  res.statusCode = 429;
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(
    JSON.stringify({
      error: "Too many requests",
      retryAfterSeconds
    })
  );
  return false;
}

const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers
  }),
  graphiql: getTrimmedEnv("NODE_ENV") !== "production",
  maskedErrors: {
    maskError: (error, message, isDev) => {
      captureBackendException(error, {
        source: "graphql-yoga"
      });
      return maskError(error, message, isDev);
    }
  },
  context: ({ request, params }) => {
    const authHeader = request.headers.get("authorization");
    const clientIp = resolveClientIpFromHeaders(request.headers);
    setGraphqlRequestScope(request, params);

    return {
      supabase: createSupabaseClient(authHeader),
      supabasePublic: createSupabasePublicClient(authHeader),
      authHeader,
      clientIp
    };
  }
});

function resolveGooglePlacesApiKey() {
  return getGooglePlacesApiKey();
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
    captureBackendException(error, {
      source: "place-photo-proxy",
      tags: {
        "http.route": "/place-photo"
      }
    });
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
    captureBackendException(error, {
      source: "route-map-proxy",
      tags: {
        "http.route": "/route-map"
      }
    });
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
  const clientIp = resolveClientIpFromRequest(req);
  setInternalClientIpHeader(req, clientIp);

  return withSentryRequestIsolation(
    {
      method: req.method || "UNKNOWN",
      pathname: url.pathname,
      search: url.search
    },
    async () => {
      try {
        if (req.method === "GET" && url.pathname === "/place-photo") {
          if (!applyHttpRateLimit(res, HTTP_RATE_LIMITS.placePhoto, clientIp)) {
            return;
          }
          await handlePlacePhotoProxy(req, res, url);
          return;
        }

        if (req.method === "GET" && url.pathname === "/route-map") {
          if (!applyHttpRateLimit(res, HTTP_RATE_LIMITS.routeMap, clientIp)) {
            return;
          }
          await handleRouteMapProxy(req, res, url);
          return;
        }

        return yoga(req, res);
      } catch (error) {
        captureBackendException(error, {
          source: "http-server",
          tags: {
            "http.route": url.pathname
          }
        });

        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "Internal server error" }));
        } else {
          res.end();
        }
      }
    }
  );
});

if (host) {
  server.listen(port, host, () => {
    logServerReady(host, port, yoga.graphqlEndpoint);
  });
} else {
  server.listen(port, () => {
    logServerReady(host, port, yoga.graphqlEndpoint);
  });
}
