'use strict';

/**
 * report-gh controller
 *
 * Defense-in-depth. Reports are normally read by populating them through the
 * guarded property endpoint. Because the `client` role is also granted
 * find/findOne on this type, direct queries are scoped here too.
 *
 * Same two protections as the property controller: ownership FILTERING (scope to
 * reports whose properties include this user) and POPULATE CONSTRAINT (never
 * populate `properties`, which would chain to `users` and leak other accounts).
 * The trusted filter is injected AFTER sanitization in `find`; the ownership
 * gate in `findOne` runs with full privileges. Status pinned to published.
 */

const { factories } = require('@strapi/strapi');
const UID = 'api::report-gh.report-gh';

// Never populate `properties` here (chains to users). Do NOT populate
// `download` on direct report-collection responses — raw media URLs are
// public-by-URL on the default upload provider. Clients download via the
// authenticated Next proxy, which loads the file URL through property
// DETAIL_POPULATE only (never exposed to the browser).
const SAFE_POPULATE = {};

module.exports = factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    await this.validateQuery(ctx);
    const sanitized = await this.sanitizeQuery(ctx);

    const query = {
      ...sanitized,
      filters: { $and: [sanitized.filters ?? {}, { properties: { users: { id: user.id } } }] },
      populate: SAFE_POPULATE,
      status: 'published',
    };

    const { results, pagination } = await strapi.service(UID).find(query);
    const sanitizedResults = await this.sanitizeOutput(results, ctx);
    return this.transformResponse(sanitizedResults, { pagination });
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;

    const owned = await strapi.documents(UID).findMany({
      filters: { documentId: id, properties: { users: { id: user.id } } },
      status: 'published',
      fields: ['id'],
      limit: 1,
    });
    if (!owned.length) return ctx.notFound();

    ctx.query = { ...ctx.query, populate: SAFE_POPULATE, status: 'published' };
    return super.findOne(ctx);
  },
}));
