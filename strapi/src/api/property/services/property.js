'use strict';

/**
 * property service
 *
 * Default core service. Required so `strapi.service('api::property.property')`
 * resolves — the scoped controller (`property.js`) calls
 * `strapi.service(UID).find(query)` directly in `find`. Without this file the
 * service is undefined and the controller throws at runtime (HTTP 500).
 */

const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::property.property');
