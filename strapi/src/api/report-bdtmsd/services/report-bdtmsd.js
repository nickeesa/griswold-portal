'use strict';

/**
 * report-bdtmsd service
 *
 * Default core service. Required so
 * `strapi.service('api::report-bdtmsd.report-bdtmsd')` resolves — the scoped
 * controller calls `strapi.service(UID).find(query)` directly in `find`.
 * Without this file the service is undefined and the controller throws (500).
 */

const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::report-bdtmsd.report-bdtmsd');
