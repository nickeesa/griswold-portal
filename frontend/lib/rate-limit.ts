// App-level login rate limit (defense-in-depth for M1).
//
// Strapi's users-permissions auth rate limit keys on the *egress* IP of the
// Next.js server, so behind this BFF every client shares one bucket. We limit
// here per client IP + identifier before proxying to Strapi.
//
// Caveat: this is an in-memory sliding window. On Vercel (and any multi-instance
// deploy) each isolate has its own Map — it throttles a single instance well but
// is not a global cluster limit. Prefer also keeping Strapi's production
// rateLimit enabled. For stronger global limits, put a WAF / edge rate limit
// in front of /api/login.

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

const hits = new Map<string, number[]>();

export function clientIpFromRequest(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function checkLoginRateLimit(
  key: string,
  { windowMs = WINDOW_MS, max = MAX_ATTEMPTS }: { windowMs?: number; max?: number } = {},
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t: number) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    const retryAfterSec = Math.max(1, Math.ceil((recent[0]! + windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true };
}

/** Test helper — clear buckets between unit tests if added later. */
export function __resetLoginRateLimitForTests() {
  hits.clear();
}
