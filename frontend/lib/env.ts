// Centralized, validated server-side environment access.
//
// login, logout, session read, the Strapi fetch helper, and the middleware
// route guard all depend on the same two values. Reading them through one
// module removes the inconsistent-fallback footgun from the review: the route
// handlers used `process.env.SESSION_COOKIE_NAME!` (no default) while
// middleware fell back to `'gh_token'`, so a missing/edited var could make the
// cookie be written and read under different names. Now every consumer shares
// one source of truth.

// Name of the httpOnly cookie holding the JWT. A single shared default means
// the route guard and the handlers can never disagree on the cookie name.
// Static `process.env.X` access (not dynamic indexing) so Next can inline it
// into the Edge middleware bundle. `|| 'gh_token'` (not `??`) so an explicitly
// set-but-empty value falls back to the default instead of yielding an empty
// cookie name.
export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME?.trim() || 'gh_token';

// Session cookie lifetime (seconds). MUST be kept in lockstep with the Strapi
// JWT expiresIn (JWT_EXPIRES_IN); for confidential data set both to 1 day or
// less. Default 7 days. Invalid/empty values fall back to the default.
export function getSessionMaxAgeSeconds(): number {
  const raw = process.env.SESSION_MAX_AGE_SECONDS?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 60 * 60 * 24 * 7;
}

// Strapi origin (server-only — no NEXT_PUBLIC_ prefix, never reaches the
// client bundle). Resolved lazily and fail-fast: a missing value throws with a
// clear message instead of fetching `undefined/api/...`. Exposed as a function
// (not a top-level constant) so merely importing this module from the Edge
// middleware never triggers the check.
export function getStrapiUrl(): string {
  const url = process.env.STRAPI_URL;
  if (!url) {
    throw new Error(
      'Missing required environment variable: STRAPI_URL. ' +
        'Set it in .env.local (dev) or the deployment environment.',
    );
  }
  return url;
}
