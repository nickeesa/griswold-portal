// AC-1 (FR-2.1) — Property list scoping.
//
// "Given a client assigned properties P1 and P2, when they request the
//  properties list with any added filter or pagination parameters, then the
//  response contains only P1 and P2 and never any property they are not
//  assigned."
//
// Mirrors property.js `find`: the ownership filter { users: { id } } is force-
// ANDed AFTER sanitization, client `populate`/`status` are ignored. No crafted
// query parameter can widen the result beyond the caller's own properties.

import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  loginFromEnv,
  apiGet,
  documentIds,
  dataArray,
  requireEnv,
} from './lib/helpers.mjs';

describe('AC-1: GET /api/properties returns ONLY the caller\'s properties', () => {
  let userA;
  let userB;
  let unownedId;

  before(async () => {
    userA = await loginFromEnv('USER_A_IDENTIFIER', 'USER_A_PASSWORD');
    userB = await loginFromEnv('USER_B_IDENTIFIER', 'USER_B_PASSWORD');
    unownedId = requireEnv('UNOWNED_PROPERTY_ID');
  });

  test('AC-1: anonymous request is rejected (no token => 401/403)', async () => {
    const res = await apiGet(null, '/api/properties');
    assert.ok(
      res.status === 401 || res.status === 403,
      `expected 401/403 without a token, got ${res.status}`,
    );
  });

  test('AC-1: baseline list returns a non-leaking set for User A', async () => {
    const res = await apiGet(userA.jwt, '/api/properties?sort=order:asc');
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
    const ids = documentIds(res.body);
    assert.ok(
      !ids.includes(unownedId),
      `User A's baseline list must not contain the unowned property ${unownedId}; got ${JSON.stringify(ids)}`,
    );
  });

  test('AC-1: User A and User B see disjoint, own-only property sets', async () => {
    const a = await apiGet(userA.jwt, '/api/properties?pagination[pageSize]=1000');
    const b = await apiGet(userB.jwt, '/api/properties?pagination[pageSize]=1000');
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);

    const aIds = new Set(documentIds(a.body));
    const bIds = new Set(documentIds(b.body));

    // Cardinality precondition: each user must actually see at least one owned
    // property, otherwise every disjointness/no-leak check below passes
    // VACUOUSLY on an empty set — a deny-all scoping bug or a broken seed
    // (ownership relation not wired) would masquerade as "safe".
    assert.ok(
      aIds.size >= 1,
      'User A must see at least one owned property — seed/ownership wiring failed (empty set makes scoping checks vacuous)',
    );
    assert.ok(
      bIds.size >= 1,
      'User B must see at least one owned property — seed/ownership wiring failed (empty set makes scoping checks vacuous)',
    );

    // The unowned property belongs to neither / not to A. Per seed data it is
    // one of User B's (or a third account's) properties and must not appear for A.
    assert.ok(!aIds.has(unownedId), `User A leaked unowned property ${unownedId}`);

    // Disjoint: no property should appear in BOTH users' scoped lists, given the
    // seed assigns distinct properties to A and B.
    const overlap = [...aIds].filter((id) => bIds.has(id));
    assert.deepEqual(
      overlap,
      [],
      `User A and User B share properties ${JSON.stringify(overlap)} — sets must be disjoint per seed data`,
    );
  });

  // Each crafted query must NEVER surface the unowned property, and must never
  // return a property whose ownership the server cannot vouch for. The server
  // force-ANDs the ownership filter post-sanitization, so all of these collapse
  // to "only User A's properties".
  const craftedQueries = [
    // Attempt to widen by re-asserting ownership of another user's id.
    '/api/properties?filters[users][id][$ne]=0',
    // Attempt to OR in a different user id.
    '/api/properties?filters[$or][0][users][id]=999999',
    // Large page size — try to dump everything.
    '/api/properties?pagination[pageSize]=1000',
    // pageSize + page combo.
    '/api/properties?pagination[page]=1&pagination[pageSize]=1000',
    // sort cannot bypass scoping.
    '/api/properties?sort=name:asc',
    // restricting fields cannot bypass scoping.
    '/api/properties?fields[0]=name&fields[1]=documentId',
    // Negation filter that, without scoping, would return "everything".
    '/api/properties?filters[name][$notNull]=true',
    // Try to filter directly TO the unowned property id.
    `/api/properties?filters[documentId][$eq]=__UNOWNED__`,
  ];

  for (const rawQuery of craftedQueries) {
    test(`AC-1: crafted query never leaks another user's property — ${rawQuery}`, async () => {
      const path =
        rawQuery.includes('__UNOWNED__')
          ? `/api/properties?filters[documentId][$eq]=${encodeURIComponent(unownedId)}`
          : rawQuery;

      const res = await apiGet(userA.jwt, path);
      // A crafted query is SAFE if it either (a) succeeds (200) and returns only
      // the caller's own properties, or (b) is rejected outright with a 4xx
      // because it references a field/relation the client role cannot read (e.g.
      // `users`). Strapi's validateQuery rejects such hostile relation filters
      // with a 400 ValidationError; that rejection returns no data, so it
      // satisfies the AC-1 invariant ("never surfaces an unowned property").
      const safe = res.status === 200 || (res.status >= 400 && res.status < 500);
      assert.ok(
        safe,
        `expected 200 or a safe 4xx rejection for ${path}, got ${res.status}: ${res.raw}`,
      );

      const ids = documentIds(res.body);
      assert.ok(
        !ids.includes(unownedId),
        `crafted query "${path}" leaked unowned property ${unownedId}; returned ${JSON.stringify(ids)}`,
      );

      // Sanity: even with pageSize=1000 the count is bounded by ownership; no
      // result should be the unowned record, and the filter-to-unowned variant
      // must return an EMPTY set (the AND with ownership wins).
      if (path.includes(encodeURIComponent(unownedId))) {
        assert.deepEqual(
          ids,
          [],
          `filtering directly to the unowned id must return nothing; got ${JSON.stringify(ids)}`,
        );
      }
    });
  }

  test('AC-1: every returned entry is a real, owned property (has documentId)', async () => {
    const res = await apiGet(userA.jwt, '/api/properties');
    assert.equal(res.status, 200);
    const entries = dataArray(res.body);
    for (const e of entries) {
      const id = e.documentId ?? e.attributes?.documentId;
      assert.ok(id, `entry missing documentId: ${JSON.stringify(e)}`);
      assert.notEqual(id, unownedId, `returned entry is the unowned property`);
    }
  });
});
