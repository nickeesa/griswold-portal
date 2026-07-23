'use strict';

/**
 * property controller
 *
 * SECURITY-CRITICAL FILE. Two independent protections are enforced here:
 *
 *  1. RESULT SCOPING (filters): the default core `find`/`findOne` would let any
 *     authenticated client read EVERY property. We restrict results to the
 *     properties assigned to the authenticated user.
 *
 *  2. POPULATE CONSTRAINT (populate): filtering does NOT constrain population.
 *     Without this, a client could populate Property -> users (or reports ->
 *     properties -> users) and read OTHER clients' usernames, emails, and the
 *     full property roster. We IGNORE any client-supplied `populate` and set an
 *     explicit server-side allow-list that never traverses to `users`.
 *
 * IMPORTANT PATTERN: in `find`, we sanitize the client query FIRST, then inject
 * the trusted ownership filter and populate allow-list AFTER sanitization, and
 * call the service directly. This guarantees the ownership filter cannot be
 * stripped or altered by query sanitization (which can drop filters on
 * relations the role lacks field access to). Doing it the other way round
 * (mutating ctx.query then calling super) risks the security filter failing
 * open. Output is still sanitized via sanitizeOutput.
 *
 * We also pin `status: 'published'` so a client cannot request drafts via
 * `?status=draft`. `ctx.state.user` comes from the verified JWT and cannot be
 * spoofed. Do not relax these overrides; never add `users` to a populate list.
 */

const { factories } = require('@strapi/strapi');
const UID = 'api::property.property';

// Server-defined populate allow-lists. NEVER include `users`.
// List: newest reports only (score/date for cards) — avoid shipping every
// historical report + media URL on My Properties. Detail still populates
// download so the authenticated Next proxy can resolve the file without a
// second round-trip; the raw URL never reaches the browser (mapped server-side).
const LIST_POPULATE = {
  image: true,
  location: true,
  reports_bdtmsds: {
    sort: ['date:desc'],
    fields: ['documentId', 'performance_score', 'date'],
  },
  reports_ghs: {
    sort: ['date:desc'],
    fields: ['documentId', 'performance_score', 'date'],
  },
};
const DETAIL_POPULATE = {
  image: true,
  location: true,
  reports_bdtmsds: { populate: { download: true } },
  reports_ghs: { populate: { download: true } },
};

module.exports = factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    await this.validateQuery(ctx);
    const sanitized = await this.sanitizeQuery(ctx);

    // Inject trusted scoping AFTER sanitizing client input so it cannot be stripped.
    const query = {
      ...sanitized,
      filters: { $and: [sanitized.filters ?? {}, { users: { id: user.id } }] },
      populate: LIST_POPULATE,
      status: 'published',
    };

    const { results, pagination } = await strapi.service(UID).find(query);
    const sanitizedResults = await this.sanitizeOutput(results, ctx);
    return this.transformResponse(sanitizedResults, { pagination });
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params; // documentId in v5

    // Ownership gate runs with full privileges (not subject to client sanitization).
    const owned = await strapi.documents(UID).findMany({
      filters: { documentId: id, users: { id: user.id } },
      status: 'published', // match what super.findOne() (published) returns
      fields: ['id'],
      limit: 1,
    });
    if (!owned.length) return ctx.notFound(); // 404, not 403 — don't leak existence

    // Constrain populate before delegating to core (which sanitizes output).
    ctx.query = { ...ctx.query, populate: DETAIL_POPULATE, status: 'published' };
    return super.findOne(ctx);
  },
}));
