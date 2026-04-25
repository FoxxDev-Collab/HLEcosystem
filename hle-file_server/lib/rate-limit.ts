/**
 * Simple in-memory rate limiter backed by a Map.
 * Sufficient for a single-process Next.js family server.
 * Key is caller-defined (e.g. "ip:token" or "ip:/api/share/...").
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Prune expired entries to prevent unbounded growth.
// Called lazily on each check — only prunes 10% of the time to avoid overhead.
function maybePrune() {
  if (Math.random() > 0.1) return;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * Returns true (allowed) or false (rate limited).
 * @param key       Unique identifier for the rate-limit bucket (e.g. "ip:1.2.3.4:token:abc")
 * @param max       Max requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  maybePrune();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) return false;
  entry.count++;
  return true;
}
