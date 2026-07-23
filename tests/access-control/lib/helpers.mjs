// Shared helpers for the access-control suite.
//
// Dependency-free: relies only on Node 18+ built-ins (global `fetch`).
// Everything is configured via environment variables (see README.md).
//
// The suite ONLY uses endpoints documented in Technical Spec §5:
//   POST /api/auth/local
//   GET  /api/properties
//   GET  /api/properties/:documentId
//   GET  /api/report-bdtmsds
//   GET  /api/report-ghs
// It never calls admin endpoints, the users-permissions user endpoints, or
// any write endpoint.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Read a required environment variable or throw a clear, actionable error.
 * @param {string} name
 * @returns {string}
 */
export function requireEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === null || v === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `See tests/access-control/README.md for the full list and seed data.`,
    );
  }
  return v;
}

/**
 * Optional environment variable with a default.
 * @param {string} name
 * @param {string|undefined} fallback
 */
export function optionalEnv(name, fallback = undefined) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

/** Base Strapi URL, no trailing slash. */
export function strapiUrl() {
  return requireEnv('STRAPI_URL').replace(/\/+$/, '');
}

/**
 * Log in via POST {STRAPI_URL}/api/auth/local and return the raw JWT string.
 * `identifier` may be a username OR an email (Strapi accepts both).
 *
 * @param {string} identifier
 * @param {string} password
 * @returns {Promise<string>} the JWT
 */
export async function login(identifier, password) {
  const res = await fetch(`${strapiUrl()}/api/auth/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.jwt) {
    throw new Error(
      `Login failed for "${identifier}" (HTTP ${res.status}). ` +
        `Check the USER_* credentials and that the account is confirmed and not blocked. ` +
        `Strapi said: ${JSON.stringify(body)}`,
    );
  }
  return body.jwt;
}

/**
 * Authenticated GET against the Strapi API.
 *
 * @param {string} jwt           Bearer token (pass null/undefined for an anonymous request)
 * @param {string} path          e.g. "/api/properties?sort=order:asc"
 * @returns {Promise<{ status: number, ok: boolean, body: any, raw: string }>}
 */
export async function apiGet(jwt, path) {
  const res = await fetch(`${strapiUrl()}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
  });
  const raw = await res.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null; // non-JSON (e.g., an error page); callers inspect `raw`
  }
  return { status: res.status, ok: res.ok, body, raw };
}

// JWT cache (rate-limit mitigation). Strapi's auth endpoint is rate-limited in
// production (10 requests / 60s — Risk R8). With one login per user per test
// FILE, a parallel `node --test` run would exceed that and fail with 429s for
// non-security reasons. We cache each user's JWT (valid 7 days per §3.5) in a
// temp file keyed by URL+identifier, so a full suite run performs ~2 logins
// total instead of ~2 per file. Run files serially (`--test-concurrency=1`,
// set in package.json) so the first file warms the cache for the rest.
//
// Only `loginFromEnv` (the read-only test fixtures) uses the cache. The raw
// `login()` always hits the network, so AC-4's re-login assertion stays honest.
const JWT_CACHE_TTL_MS = 30 * 60 * 1000;

function jwtCacheFile(identifier) {
  const key = crypto
    .createHash('sha256')
    .update(`${strapiUrl()}|${identifier}`)
    .digest('hex')
    .slice(0, 32);
  return path.join(os.tmpdir(), `ac-jwt-${key}.json`);
}

/**
 * Build a login session bundle: { jwt, identifier }. Reuses a cached JWT when
 * one is available and fresh (see JWT cache note above).
 * @param {string} identifierEnv
 * @param {string} passwordEnv
 */
export async function loginFromEnv(identifierEnv, passwordEnv) {
  const identifier = requireEnv(identifierEnv);
  const password = requireEnv(passwordEnv);

  const cacheFile = jwtCacheFile(identifier);
  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (cached.jwt && Date.now() - cached.ts < JWT_CACHE_TTL_MS) {
      return { jwt: cached.jwt, identifier };
    }
  } catch {
    /* cache miss / unreadable — fall through to a live login */
  }

  const jwt = await login(identifier, password);
  try {
    fs.writeFileSync(cacheFile, JSON.stringify({ jwt, ts: Date.now() }), { mode: 0o600 });
  } catch {
    /* best-effort cache; ignore write failures */
  }
  return { jwt, identifier };
}

/**
 * Normalize a Strapi 5 list response to a plain array of entries.
 * Tolerates both `{ data: [...] }` and a bare array.
 * @param {any} body
 * @returns {any[]}
 */
export function dataArray(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.data)) return body.data;
  return [];
}

/**
 * Extract documentIds from a Strapi 5 list response.
 * @param {any} body
 * @returns {string[]}
 */
export function documentIds(body) {
  return dataArray(body)
    .map((e) => e && (e.documentId ?? e.attributes?.documentId))
    .filter(Boolean);
}

/**
 * Recursively scan an arbitrary JSON value for the presence of forbidden keys.
 * Used to assert that populated output never includes user-roster / PII fields.
 *
 * @param {any} value
 * @param {string[]} forbiddenKeys  key names that must never appear
 * @returns {string[]}  list of "path -> key" strings where a forbidden key was found
 */
export function findForbiddenKeys(value, forbiddenKeys, path = '$') {
  const hits = [];
  const forbidden = new Set(forbiddenKeys);

  const walk = (node, p) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${p}[${i}]`));
      return;
    }
    for (const key of Object.keys(node)) {
      if (forbidden.has(key)) {
        hits.push(`${p}.${key}`);
      }
      walk(node[key], `${p}.${key}`);
    }
  };

  walk(value, path);
  return hits;
}

/**
 * Recursively scan for any string value that looks like an email address.
 * Catches placeholder emails that might leak even under an unexpected key name.
 * @param {any} value
 * @returns {string[]} matched email-like strings (capped)
 */
export function findEmailLikeStrings(value, cap = 20) {
  const re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const hits = [];
  const walk = (node) => {
    if (hits.length >= cap) return;
    if (typeof node === 'string') {
      if (re.test(node)) hits.push(node);
      return;
    }
    if (node && typeof node === 'object') {
      for (const v of Object.values(node)) walk(v);
    }
  };
  walk(value);
  return hits;
}
