import { publicEnv } from "@/lib/env";

const GOOGLE_PLACE_MEDIA_PATTERN = /\/v1\/(places\/[^/]+\/photos\/[^/?#]+)\/media/i;

function resolveBackendOrigin() {
  try {
    return new URL(publicEnv.graphqlEndpoint).origin;
  } catch {
    return "";
  }
}

export function resolvePlacePhotoUrl(rawUrl: string | null | undefined, maxWidthPx = 320) {
  if (!rawUrl) return "";

  const matched = rawUrl.match(GOOGLE_PLACE_MEDIA_PATTERN);
  if (!matched?.[1]) {
    return rawUrl;
  }

  const backendOrigin = resolveBackendOrigin();
  if (!backendOrigin) {
    return rawUrl;
  }

  const params = new URLSearchParams({
    name: matched[1],
    maxWidthPx: String(maxWidthPx)
  });

  return `${backendOrigin}/place-photo?${params.toString()}`;
}
