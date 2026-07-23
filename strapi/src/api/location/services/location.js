'use strict';

/**
 * location service
 *
 * Default core service. Required so `strapi.service('api::location.location')`
 * resolves — the scoped controller (`location.js`) calls
 * `strapi.service(UID).find(query)` directly. Without this file the service is
 * undefined and the controller throws at runtime (HTTP 500).
 */

const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::location.location');
