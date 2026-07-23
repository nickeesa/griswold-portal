'use strict';
const { factories } = require('@strapi/strapi');

// SECURITY: read-only over the content API. Only `find` and `findOne` are
// registered (both ownership-scoped in the controller); create/update/delete
// are intentionally NOT exposed. A client must never mutate audit data, and the
// write surface must not depend solely on the admin-configured role permissions.
module.exports = factories.createCoreRouter('api::report-bdtmsd.report-bdtmsd', {
  only: ['find', 'findOne'],
});
