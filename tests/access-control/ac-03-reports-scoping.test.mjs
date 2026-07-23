// AC-3 (FR-2.3) — Direct report collection queries are scoped.
//
// "Given a client, when they query a report collection directly, then only
//  reports tied to their assigned properties are returned."
//
// Mirrors report-bdtmsd.js / report-gh.js `find`: ownership filter
// { properties: { users: { id } } } force-ANDed after sanitization; populate is
// SAFE_POPULATE ({}) only — `properties` and raw `download` URLs are never populated.

import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  loginFromEnv,
  apiGet,
  documentIds,
  findForbiddenKeys,
} from './lib/helpers.mjs';

const REPORT_ENDPOINTS = ['/api/report-bdtmsds', '/api/report-ghs'];

describe('AC-3: report collections return only the caller\'s reports', () => {
  let userA;
  let userB;

  before(async () => {
    userA = await loginFromEnv('USER_A_IDENTIFIER', 'USER_A_PASSWORD');
    userB = await loginFromEnv('USER_B_IDENTIFIER', 'USER_B_PASSWORD');
  });

  for (const endpoint of REPORT_ENDPOINTS) {
    test(`AC-3: ${endpoint} requires auth (anonymous => 401/403)`, async () => {
      const res = await apiGet(null, endpoint);
      assert.ok(
        res.status === 401 || res.status === 403,
        `expected 401/403 without token on ${endpoint}, got ${res.status}`,
      );
    });

    test(`AC-3: ${endpoint} returns 200 and a disjoint set for A vs B`, async () => {
      const a = await apiGet(userA.jwt, `${endpoint}?pagination[pageSize]=1000`);
      const b = await apiGet(userB.jwt, `${endpoint}?pagination[pageSize]=1000`);
      assert.equal(a.status, 200, `A got ${a.status}: ${a.raw}`);
      assert.equal(b.status, 200, `B got ${b.status}: ${b.raw}`);

      const aIds = new Set(documentIds(a.body));
      const bIds = new Set(documentIds(b.body));

      // Cardinality precondition: each user must see at least one owned report,
      // else the disjointness check below passes vacuously on an empty set (a
      // deny-all bug or a broken seed relation would look "safe").
      assert.ok(
        aIds.size >= 1,
        `${endpoint}: User A must see at least one owned report — seed/ownership wiring failed (empty set makes the disjointness check vacuous)`,
      );
      assert.ok(
        bIds.size >= 1,
        `${endpoint}: User B must see at least one owned report — seed/ownership wiring failed (empty set makes the disjointness check vacuous)`,
      );

      // Per seed data A and B own different properties, so their report sets do
      // not overlap.
      const overlap = [...aIds].filter((id) => bIds.has(id));
      assert.deepEqual(
        overlap,
        [],
        `${endpoint}: A and B share reports ${JSON.stringify(overlap)} — must be disjoint per seed data`,
      );
    });

    test(`AC-3: ${endpoint} cannot be widened by crafted filters`, async () => {
      // Without the trusted scope, this OR would return reports belonging to
      // other properties. With scoping it stays bounded to the caller's reports.
      const widened = await apiGet(
        userA.jwt,
        `${endpoint}?filters[$or][0][properties][users][id]=999999&pagination[pageSize]=1000`,
      );
      const baseline = await apiGet(userA.jwt, `${endpoint}?pagination[pageSize]=1000`);
      // The crafted $or references `properties.users`, a relation the client
      // role cannot read. Strapi may reject it with a 400 (safe — returns no
      // data) or scope it to the caller's own reports. Either outcome is
      // acceptable provided it surfaces nothing outside the caller's baseline.
      assert.ok(
        widened.status === 200 || (widened.status >= 400 && widened.status < 500),
        `expected 200 or a safe 4xx for the crafted filter, got ${widened.status}: ${widened.raw}`,
      );
      assert.equal(baseline.status, 200);

      const widenedIds = new Set(documentIds(widened.body));
      const baselineIds = new Set(documentIds(baseline.body));

      // The crafted filter must not surface any report not already in the
      // caller's own scoped baseline.
      const extra = [...widenedIds].filter((id) => !baselineIds.has(id));
      assert.deepEqual(
        extra,
        [],
        `${endpoint}: crafted $or filter surfaced extra reports ${JSON.stringify(extra)}`,
      );
    });

    test(`AC-3: ${endpoint} never populates properties/users (no chain leak)`, async () => {
      const res = await apiGet(userA.jwt, endpoint);
      assert.equal(res.status, 200);
      // SAFE_POPULATE is {} (no download / properties); properties/users must not appear.
      const hits = findForbiddenKeys(res.body, ['properties', 'users', 'email', 'username']);
      assert.deepEqual(
        hits,
        [],
        `${endpoint} leaked forbidden keys via population: ${JSON.stringify(hits)}`,
      );
    });
  }
});
