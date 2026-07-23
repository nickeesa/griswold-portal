'use strict';

/**
 * location controller
 *
 * Location is populated through the guarded property endpoint. Strapi gates
 * population by the populated type's read permission, so the `client` role must
 * be granted find/findOne on Location for `location.name` to appear on a
 * property. To prevent that grant from exposing the full list of every location
 * Griswold operates in, this controller scopes direct /api/locations access to
 * only the locations of the requesting user's assigned properties, and never
 * populates relations (which would chain to users). The trusted filter is
 * injected after sanitization in `find`; the ownership gate in `findOne` runs
 * with full privileges. Status pinned to published.
 */

const { factories } = require('@strapi/strapi');
const UID = 'api::location.location';

module.exports = factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    await this.validateQuery(ctx);
    const sanitized = await this.sanitizeQuery(ctx);

    const query = {
      ...sanitized,
      filters: { $and: [sanitized.filters ?? {}, { properties: { users: { id: user.id } } }] },
      populate: {}, // do not populate relations (avoids the properties -> users chain)
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

    ctx.query = { ...ctx.query, populate: {}, status: 'published' };
    return super.findOne(ctx);
  },
}));
