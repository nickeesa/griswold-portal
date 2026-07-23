// AC-2 (FR-2.2) — findOne on an unassigned property returns 404, no leak.
//
// "Given a client not assigned property P9, when they request P9 by id, then
//  the server responds 404 with no property data and no indication P9 exists."
//
// Mirrors property.js `findOne`: the ownership gate runs with full privileges
// and returns ctx.notFound() (404, NOT 403) on a miss so existence isn't leaked.

import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loginFromEnv, apiGet, requireEnv } from './lib/helpers.mjs';

describe('AC-2: GET /api/properties/{UNOWNED_PROPERTY_ID} => 404, no body data', () => {
  let userA;
  let unownedId;

  before(async () => {
    userA = await loginFromEnv('USER_A_IDENTIFIER', 'USER_A_PASSWORD');
    unownedId = requireEnv('UNOWNED_PROPERTY_ID');
  });

  test('AC-2: unowned property by id returns exactly 404 (not 403)', async () => {
    const res = await apiGet(userA.jwt, `/api/properties/${encodeURIComponent(unownedId)}`);
    assert.equal(
      res.status,
      404,
      `expected 404 for unowned property, got ${res.status}: ${res.raw}`,
    );
    assert.notEqual(res.status, 403, '403 would confirm existence — must be 404');
  });

  test('AC-2: 404 response carries no property data', async () => {
    const res = await apiGet(userA.jwt, `/api/properties/${encodeURIComponent(unownedId)}`);
    // Strapi notFound() returns { data: null, error: { status: 404, ... } }.
    const data = res.body?.data;
    assert.ok(
      data === null || data === undefined,
      `404 body must not include property data; got data=${JSON.stringify(data)}`,
    );
  });

  test('AC-2: no existence leak — error body contains no name/location/report fields', async () => {
    const res = await apiGet(userA.jwt, `/api/properties/${encodeURIComponent(unownedId)}`);
    // Strapi's 404 envelope is framework-only: { data: null, error: { status,
    // name: 'NotFoundError', message, details } }. The `error.name`/`error.status`
    // keys belong to that scaffold, NOT to the property — scanning them would be
    // a false positive. The real leak surface is any place a record's data could
    // appear: `data`, and the error's `message`/`details`.
    const err = res.body?.error ?? {};
    assert.equal(res.body?.data ?? null, null, `404 must carry no data: ${res.raw}`);
    assert.equal(err.name, 'NotFoundError', `unexpected 404 error shape: ${res.raw}`);
    const leakSurface = JSON.stringify({
      data: res.body?.data ?? null,
      message: err.message ?? '',
      details: err.details ?? {},
    }).toLowerCase();
    for (const leakKey of ['"name"', '"location"', '"reports_bdtmsds"', '"reports_ghs"', '"image"', '"performance_score"']) {
      assert.ok(
        !leakSurface.includes(leakKey),
        `404 body appears to leak property field ${leakKey}: ${res.raw}`,
      );
    }
  });

  test('AC-2: crafted populate/status on the unowned-id request still 404s', async () => {
    const res = await apiGet(
      userA.jwt,
      `/api/properties/${encodeURIComponent(unownedId)}?populate[users]=*&status=draft`,
    );
    assert.equal(
      res.status,
      404,
      `crafted query on unowned id must still 404, got ${res.status}: ${res.raw}`,
    );
  });
});
