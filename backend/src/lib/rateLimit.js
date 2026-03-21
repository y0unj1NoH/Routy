const RATE_LIMIT_STORE = new Map();
const CLEANUP_INTERVAL_MS = 60 * 1000;
let lastCleanupAt = 0;

function cleanupExpiredEntries(now) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupAt = now;
  for (const [key, entry] of RATE_LIMIT_STORE.entries()) {
    if (!entry || entry.resetAt <= now) {
      RATE_LIMIT_STORE.delete(key);
    }
  }
}

function takeRateLimit({ bucket, identifier, limit, windowMs, now = Date.now() }) {
  if (!bucket) {
    throw new Error("bucket is required");
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("limit must be a positive integer");
  }
  if (!Number.isInteger(windowMs) || windowMs < 1000) {
    throw new Error("windowMs must be at least 1000");
  }

  cleanupExpiredEntries(now);

  const key = `${bucket}:${identifier || "anonymous"}`;
  const current = RATE_LIMIT_STORE.get(key);
  if (!current || current.resetAt <= now) {
    const entry = { count: 1, resetAt: now + windowMs };
    RATE_LIMIT_STORE.set(key, entry);
    return {
      allowed: true,
      count: entry.count,
      limit,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetAt
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      count: current.count,
      limit,
      remaining: 0,
      resetAt: current.resetAt
    };
  }

  current.count += 1;
  return {
    allowed: true,
    count: current.count,
    limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt
  };
}

function getRetryAfterSeconds(result, now = Date.now()) {
  return Math.max(1, Math.ceil((result.resetAt - now) / 1000));
}

module.exports = {
  takeRateLimit,
  getRetryAfterSeconds
};
