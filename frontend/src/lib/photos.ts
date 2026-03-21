import { publicEnv } from "@/lib/env";

const GOOGLE_PLACE_MEDIA_PATTERN = /\/v1\/(places\/[^/]+\/photos\/[^/?#]+)\/media/i;

export type ResolvablePlacePhoto =
  | {
      name?: string | null;
      displayName?: string | null;
      uri?: string | null;
    }
  | string
  | null
  | undefined;

function resolveBackendOrigin() {
  try {
    return new URL(publicEnv.graphqlEndpoint).origin;
  } catch {
    return "";
  }
}

function extractPhotoResourceName(photo: ResolvablePlacePhoto) {
  if (!photo) return "";

  if (typeof photo === "object") {
    const name = typeof photo.name === "string" ? photo.name.trim() : "";
    if (/^places\/[^/]+\/photos\/[^/?#]+$/i.test(name)) {
      return name;
    }
    return "";
  }

  const matched = photo.match(GOOGLE_PLACE_MEDIA_PATTERN);
  if (matched?.[1]) {
    return matched[1];
  }

  if (/^places\/[^/]+\/photos\/[^/?#]+$/i.test(photo.trim())) {
    return photo.trim();
  }

  return "";
}

export function resolvePlacePhotoUrl(photo: ResolvablePlacePhoto, maxWidthPx = 320) {
  const resourceName = extractPhotoResourceName(photo);
  if (!resourceName) {
    return typeof photo === "string" ? photo : "";
  }

  const backendOrigin = resolveBackendOrigin();
  if (!backendOrigin) {
    return typeof photo === "string" ? photo : "";
  }

  const params = new URLSearchParams({
    name: resourceName,
    maxWidthPx: String(maxWidthPx)
  });

  return `${backendOrigin}/place-photo?${params.toString()}`;
}
