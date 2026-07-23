'use strict';

/**
 * report-gh service
 *
 * Default core service. Required so
 * `strapi.service('api::report-gh.report-gh')` resolves — the scoped controller
 * calls `strapi.service(UID).find(query)` directly in `find`. Without this file
 * the service is undefined and the controller throws at runtime (HTTP 500).
 */

const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::report-gh.report-gh');
