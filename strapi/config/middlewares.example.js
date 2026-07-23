'use strict';

/**
 * ============================================================================
 *  EXAMPLE — DO NOT DROP IN AS-IS.  MERGE THIS INTO YOUR PROJECT'S
 *  config/middlewares.js.
 * ============================================================================
 *
 * This file is a REFERENCE for the CORS configuration only (Technical Spec
 * §3.6, as corrected in v2.1). It is intentionally NOT shipped as the live
 * `config/middlewares.js`, because every Strapi project already has its own
 * `config/middlewares.js` whose default middleware ARRAY ORDER matters.
 * Replacing that file wholesale would override the project's middleware order
 * and could break other middleware.
 *
 * To use:
 *   1. Open your project's existing config/middlewares.js.
 *   2. Copy the PROD_ORIGIN constant below to the top of that file.
 *   3. Replace the project's existing `'strapi::cors'` entry (often a bare
 *      string) with the configured `{ name: 'strapi::cors', config: {...} }`
 *      object below — keeping the rest of the project's array order intact.
 *   4. Restart Strapi.
 *
 * NOTE: CORS here is DEFENSE-IN-DEPTH, not the security boundary. The browser
 * never calls Strapi directly for protected data; Next.js fetches server-side.
 * The real boundary is the scoped controllers (Technical Spec §3.3).
 * ============================================================================
 */

// Keep in sync with companion griswold-strapi/config/middlewares.ts.
const PROD_ORIGIN = 'https://griswold-portal-nine.vercel.app';

module.exports = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      // @koa/cors requires the resolver to return a STRING (the origin to
      // allow), not a boolean. For disallowed origins we return PROD_ORIGIN
      // as a safe, NON-REFLECTING default; the browser then blocks the
      // mismatched cross-origin request.
      origin: (ctx) => {
        // localhost is only a valid origin in dev/test — never accept it as a
        // credentialed cross-origin caller against the production API.
        // Preview CORS removed: Production-only portal deploys.
        const allowed =
          process.env.NODE_ENV === 'production'
            ? [PROD_ORIGIN]
            : [PROD_ORIGIN, 'http://localhost:3000'];
        const reqOrigin = ctx.request.header.origin;
        if (reqOrigin && allowed.includes(reqOrigin)) return reqOrigin;
        // Disallowed: return a safe default (never reflect an untrusted origin).
        return PROD_ORIGIN;
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
    },
  },
  // 'strapi::poweredBy' removed — don't advertise the server via X-Powered-By.
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
