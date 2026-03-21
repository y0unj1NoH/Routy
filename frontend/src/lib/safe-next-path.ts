const INTERNAL_REDIRECT_PARSE_BASE = "https://myrouty.invalid";
const DEFAULT_NEXT_PATH = "/";

export function sanitizeNextPath(input: string | null | undefined, fallback = DEFAULT_NEXT_PATH) {
  const trimmed = String(input || "").trim();
  if (!trimmed) {
    return fallback;
  }

  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }

  try {
    // This base is only used to parse relative paths; it is not tied to the deployed app origin.
    const parsed = new URL(trimmed, INTERNAL_REDIRECT_PARSE_BASE);
    if (parsed.origin !== INTERNAL_REDIRECT_PARSE_BASE || parsed.pathname.startsWith("//")) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
