// Pure helpers for the F10 authenticated download proxy.
// Extracted so ownership / CSRF / SSRF / status mapping can be unit-tested
// without spinning up Next.js. This is the SINGLE source of truth: the download
// route imports these helpers, and the F10 release-blocker suite
// (tests/download-proxy/) imports THIS module directly — so the tests exercise
// the exact code that ships. Authored as `.mjs` (not `.ts`) so `node --test` can
// import it with zero deps on CI's Node 20, which cannot load TypeScript natively.

/**
 * CSRF: allow same-origin / same-site / none / missing; reject cross-site.
 * @param {string | null} site
 * @returns {boolean}
 */
export function isAllowedSecFetchSite(site) {
  if (!site) return true;
  return site === 'same-origin' || site === 'same-site' || site === 'none';
}

/**
 * Map the guarded property findOne status to a proxy response status.
 * @param {number} status
 * @returns {404 | 401 | 403 | 500 | null}
 */
export function mapOwnershipStatus(status) {
  if (status === 404) return 404;
  if (status === 401 || status === 403) return status;
  if (status >= 200 && status < 300) return null; // proceed
  return 500;
}

/**
 * Resolve a Strapi media URL to an absolute URL on the configured Strapi
 * origin only. Relative `/uploads/...` paths are prefixed; absolute URLs must
 * match `strapiOrigin` or this returns null (SSRF guard → caller 404s).
 * @param {string} fileUrl
 * @param {string} strapiBaseUrl
 * @returns {string | null}
 */
export function resolveStrapiMediaUrl(fileUrl, strapiBaseUrl) {
  const strapiOrigin = new URL(strapiBaseUrl).origin;
  if (fileUrl.startsWith('http')) {
    try {
      if (new URL(fileUrl).origin !== strapiOrigin) return null;
      return fileUrl;
    } catch {
      return null;
    }
  }
  return `${strapiBaseUrl.replace(/\/+$/, '')}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
}

/**
 * Sanitize report type for Content-Disposition filename.
 * @param {string | null | undefined} type
 * @returns {string}
 */
export function sanitizeDownloadBasename(type) {
  return (type ?? 'report').replace(/[^\w.\- ]+/g, '_').slice(0, 100);
}

/**
 * Extension from upstream URL path (default .pdf).
 * @param {string} fileUrl
 * @returns {string}
 */
export function extensionFromFileUrl(fileUrl) {
  return fileUrl.split('?')[0].match(/\.[a-z0-9]+$/i)?.[0] ?? '.pdf';
}
