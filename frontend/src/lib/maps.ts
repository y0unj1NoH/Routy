import { publicEnv } from "@/lib/env";

type RouteMapPoint = {
  lat: number;
  lng: number;
};

function resolveBackendOrigin() {
  try {
    return new URL(publicEnv.graphqlEndpoint).origin;
  } catch {
    return "";
  }
}

export function buildMapEmbedUrl(params: { lat?: number | null; lng?: number | null; query?: string | null }) {
  const { lat, lng, query } = params;

  if (typeof lat === "number" && typeof lng === "number") {
    return `${publicEnv.googleMapsEmbedBase}?q=${lat},${lng}&output=embed`;
  }

  if (query && query.trim()) {
    return `${publicEnv.googleMapsEmbedBase}?q=${encodeURIComponent(query)}&output=embed`;
  }

  return `${publicEnv.googleMapsEmbedBase}?output=embed`;
}

export function buildGoogleDirectionsEmbedUrl(points: RouteMapPoint[], fallbackQuery?: string | null) {
  const safePoints = (points || []).filter(
    (point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng)
  );

  if (safePoints.length === 0) {
    return buildMapEmbedUrl({ query: fallbackQuery || null });
  }

  if (safePoints.length === 1) {
    return buildMapEmbedUrl({
      lat: safePoints[0].lat,
      lng: safePoints[0].lng,
      query: fallbackQuery || null
    });
  }

  const origin = `${safePoints[0].lat},${safePoints[0].lng}`;
  const destinationChain = safePoints.slice(1).map((point) => `${point.lat},${point.lng}`).join("+to:");

  const params = new URLSearchParams({
    saddr: origin,
    daddr: destinationChain,
    output: "embed"
  });

  return `https://www.google.com/maps?${params.toString()}`;
}

export function buildRouteMapImageUrl(points: RouteMapPoint[], options?: { width?: number; height?: number }) {
  const backendOrigin = resolveBackendOrigin();
  const safePoints = (points || []).filter(
    (point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng)
  );

  if (!backendOrigin || safePoints.length === 0) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("width", String(options?.width ?? 640));
  params.set("height", String(options?.height ?? 360));

  safePoints.forEach((point) => {
    params.append("point", `${point.lat},${point.lng}`);
  });

  return `${backendOrigin}/route-map?${params.toString()}`;
}
