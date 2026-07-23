// AC-24 (FR-2.2) — No drafts via the API.
//
// "Given a client, when they request any collection with ?status=draft, then no
//  unpublished or privileged data is returned."
//
// Mirrors all controllers: each override pins `status: 'published'`, so a client
// cannot pull drafts via ?status=draft. (Strapi 5's legacy ?publicationState=
// preview is also covered: the server-pinned status wins regardless.)
//
// Strategy: a draft-requesting call must return the SAME data as (or a subset
// of) the default published call — never MORE entries, and never an entry the
// published view doesn't contain.

import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loginFromEnv, apiGet, documentIds, optionalEnv } from './lib/helpers.mjs';

const COLLECTIONS = ['/api/properties', '/api/report-bdtmsds', '/api/report-ghs'];

describe('AC-24: ?status=draft / ?publicationState=preview return nothing privileged', () => {
  let userA;
  // A known draft property owned by User A (seed prints DRAFT_PROPERTY_ID).
  // Enables the ABSOLUTE check below; if unset, that test skips (the relative
  // checks still run).
  const draftPropertyId = optionalEnv('DRAFT_PROPERTY_ID');

  before(async () => {
    userA = await loginFromEnv('USER_A_IDENTIFIER', 'USER_A_PASSWORD');
  });

  for (const base of COLLECTIONS) {
    test(`AC-24: ${base}?status=draft returns no extra (unpublished) entries`, async () => {
      const published = await apiGet(userA.jwt, `${base}?pagination[pageSize]=1000`);
      const draft = await apiGet(userA.jwt, `${base}?status=draft&pagination[pageSize]=1000`);

      assert.equal(published.status, 200, `published ${base}: ${published.raw}`);
      assert.equal(draft.status, 200, `draft ${base}: ${draft.raw}`);

      const publishedIds = new Set(documentIds(published.body));
      const draftIds = documentIds(draft.body);

      // The published view is the oracle for the relative diff below, so it must
      // be non-empty — otherwise a co-occurring break (both calls leaking the
      // same drafts) would diff to empty and pass vacuously.
      assert.ok(
        publishedIds.size >= 1,
        `${base}: published baseline is empty — seed/ownership wiring failed (relative draft check would be vacuous)`,
      );

      // The draft request must not surface any entry absent from the published
      // (server-pinned) view.
      const extra = draftIds.filter((id) => !publishedIds.has(id));
      assert.deepEqual(
        extra,
        [],
        `${base}?status=draft surfaced unpublished entries ${JSON.stringify(extra)} — server must pin status:'published'`,
      );
    });

    test(`AC-24: ${base}?publicationState=preview returns no extra entries`, async () => {
      const published = await apiGet(userA.jwt, `${base}?pagination[pageSize]=1000`);
      const preview = await apiGet(
        userA.jwt,
        `${base}?publicationState=preview&pagination[pageSize]=1000`,
      );

      assert.equal(published.status, 200, `published ${base}: ${published.raw}`);
      // Version-tolerant: Strapi 5.37.x accepts the legacy v4 key (status 200);
      // newer minors (e.g. 5.50.x) hard-reject unknown query keys with 4xx.
      // Either outcome is safe provided no unpublished extras are returned.
      const safe =
        preview.status === 200 || (preview.status >= 400 && preview.status < 500);
      assert.ok(
        safe,
        `preview ${base}: expected 200 or safe 4xx, got ${preview.status} ${preview.raw}`,
      );
      if (preview.status !== 200) return;

      const publishedIds = new Set(documentIds(published.body));
      const previewIds = documentIds(preview.body);

      const extra = previewIds.filter((id) => !publishedIds.has(id));
      assert.deepEqual(
        extra,
        [],
        `${base}?publicationState=preview surfaced unpublished entries ${JSON.stringify(extra)}`,
      );
    });
  }

  // Absolute check: a KNOWN draft property owned by User A must never appear in
  // any view — default, ?status=draft, or ?publicationState=preview. This is
  // stronger than the relative diffs above (which can't detect a leak that is
  // already present in BOTH the default and draft responses). Requires a seeded
  // draft (DRAFT_PROPERTY_ID); skips otherwise.
  test(
    'AC-24: a known draft property owned by the user is never served (absolute)',
    { skip: draftPropertyId ? false : 'DRAFT_PROPERTY_ID not set — seed a draft property owned by User A to enable' },
    async () => {
      const variants = [
        { path: '/api/properties?pagination[pageSize]=1000', allow4xx: false },
        { path: '/api/properties?status=draft&pagination[pageSize]=1000', allow4xx: false },
        {
          path: '/api/properties?publicationState=preview&pagination[pageSize]=1000',
          allow4xx: true, // legacy key may 4xx on Strapi > 5.37
        },
      ];
      for (const { path, allow4xx } of variants) {
        const res = await apiGet(userA.jwt, path);
        if (allow4xx) {
          const safe = res.status === 200 || (res.status >= 400 && res.status < 500);
          assert.ok(safe, `${path}: ${res.status} ${res.raw}`);
          if (res.status !== 200) continue; // rejection ⇒ no draft body leaked
        } else {
          assert.equal(res.status, 200, `${path}: ${res.raw}`);
        }
        assert.ok(
          !documentIds(res.body).includes(draftPropertyId),
          `${path} surfaced the draft property ${draftPropertyId} — drafts must never be served`,
        );
      }
    },
  );
});
