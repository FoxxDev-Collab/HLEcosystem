// In-memory login throttle (AC-7). Single-process by design — this app runs
// as one Bun instance, so no shared store is needed; a restart clearing the
// counters is an accepted trade-off for a dependency-free self-host default.
//
// Two independent dimensions, both checked BEFORE the bcrypt verify so an
// unauthenticated caller cannot burn ~250ms of CPU per guess:
//  - per-email: the primary control. Keyed on the submitted email whether or
//    not the account exists, so a throttled response never confirms an email.
//  - per-IP: a coarser backstop against one source spraying many emails. The
//    IP comes from x-forwarded-for and is only as trustworthy as the reverse
//    proxy in front (spoofable when the app is exposed directly), which is
//    why the per-email limit carries the real weight and this one is loose.

const WINDOW_MS = 15 * 60 * 1000
const LOCK_MS = 15 * 60 * 1000
export const EMAIL_MAX_FAILS = 5
export const IP_MAX_FAILS = 30

// Memory bound: an attacker cycling random emails must not grow the map
// forever. Past the cap, expired entries are dropped first, then the oldest.
const MAX_ENTRIES = 5000

type Bucket = { fails: number; windowStart: number; lockedUntil: number }

function makeStore(maxFails: number) {
  const buckets = new Map<string, Bucket>()

  function prune(now: number) {
    if (buckets.size <= MAX_ENTRIES) return
    for (const [key, b] of buckets) {
      const expired = b.lockedUntil <= now && now - b.windowStart > WINDOW_MS
      if (expired) buckets.delete(key)
    }
    // Still over (active flood): drop oldest insertion order first.
    while (buckets.size > MAX_ENTRIES) {
      const oldest = buckets.keys().next().value
      if (oldest === undefined) break
      buckets.delete(oldest)
    }
  }

  return {
    // Seconds the caller must still wait, or 0 when allowed.
    retryAfterSec(key: string, now: number): number {
      const b = buckets.get(key)
      if (!b) return 0
      if (b.lockedUntil > now) return Math.ceil((b.lockedUntil - now) / 1000)
      return 0
    },
    recordFailure(key: string, now: number): void {
      prune(now)
      const b = buckets.get(key)
      if (!b || now - b.windowStart > WINDOW_MS) {
        buckets.set(key, { fails: 1, windowStart: now, lockedUntil: 0 })
        return
      }
      b.fails++
      if (b.fails >= maxFails) {
        b.lockedUntil = now + LOCK_MS
        // Locking starts a fresh window so post-lock failures re-count from 0.
        b.windowStart = now
        b.fails = 0
      }
    },
    clear(key: string): void {
      buckets.delete(key)
    },
    size(): number {
      return buckets.size
    },
    resetAll(): void {
      buckets.clear()
    },
  }
}

const emailStore = makeStore(EMAIL_MAX_FAILS)
const ipStore = makeStore(IP_MAX_FAILS)

export type ThrottleVerdict =
  { allowed: true } | { allowed: false; retryAfterSec: number }

export function checkLoginAllowed(
  email: string,
  ip: string | null,
  now: number = Date.now()
): ThrottleVerdict {
  const emailWait = emailStore.retryAfterSec(email.toLowerCase(), now)
  const ipWait = ip ? ipStore.retryAfterSec(ip, now) : 0
  const wait = Math.max(emailWait, ipWait)
  if (wait > 0) return { allowed: false, retryAfterSec: wait }
  return { allowed: true }
}

export function recordLoginFailure(
  email: string,
  ip: string | null,
  now: number = Date.now()
): void {
  emailStore.recordFailure(email.toLowerCase(), now)
  if (ip) ipStore.recordFailure(ip, now)
}

// A successful login clears the email's failure history. The IP bucket is
// deliberately left alone — success on one account must not refill an IP
// that is spraying many accounts.
export function recordLoginSuccess(email: string): void {
  emailStore.clear(email.toLowerCase())
}

// Test hooks.
export const _throttleInternals = { emailStore, ipStore }
