// AC-23 (FR-2.4) — Populate cannot leak other accounts.
//
// "Given a client, when they request properties or reports with a populate that
//  traverses to users (e.g. populate[users]=*, or
//  populate[properties][populate][users]=* on a report), then the response
//  contains NO other-account data — no usernames, emails, or property rosters."
//
// Mirrors all controllers: client `populate` is IGNORED and replaced by a
// server-side allow-list that never traverses to `users`; report/location
// controllers never populate `properties` (which would chain to users). The
// `users` / report `properties` relations are also marked `private` in the
// schema, so on the list endpoints `validateQuery` REJECTS a populate that
// names them with a 400 ValidationError before any data is read.
//
// A request is SAFE if it is rejected outright (4xx — no data returned) OR
// succeeds (200) with no `users` / `email` / `username` field and no email-like
// string anywhere in the output.

import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  loginFromEnv,
  apiGet,
  findForbiddenKeys,
  findEmailLikeStrings,
} from './lib/helpers.mjs';

// NOTE: `provider` is intentionally NOT listed. The allowed `download` media
// relation carries a benign `provider` field (the upload storage backend, e.g.
// "local") that is unrelated to user accounts and would cause a false positive.
// A genuine user-account leak is still caught here by `users` / `email` /
// `username` / `password` / the reset+confirmation tokens — any leaked user
// object necessarily carries those.
const FORBIDDEN_KEYS = ['users', 'email', 'username', 'password', 'resetPasswordToken', 'confirmationToken'];

// Each entry: a request that attempts to chain population to user accounts.
const LEAK_ATTEMPTS = [
  {
    label: 'properties + populate[users]=*',
    path: '/api/properties?populate[users]=*',
  },
  {
    label: 'properties + populate=* (wildcard everything)',
    path: '/api/properties?populate=*',
  },
  {
    label: 'properties + nested populate reports_ghs->properties->users',
    path: '/api/properties?populate[reports_ghs][populate][properties][populate][users]=*',
  },
  {
    label: 'properties + nested populate reports_bdtmsds->properties->users',
    path: '/api/properties?populate[reports_bdtmsds][populate][properties][populate][users]=*',
  },
  {
    label: 'report-bdtmsds + populate[properties][populate][users]=*',
    path: '/api/report-bdtmsds?populate[properties][populate][users]=*',
  },
  {
    label: 'report-ghs + populate[properties][populate][users]=*',
    path: '/api/report-ghs?populate[properties][populate][users]=*',
  },
  {
    label: 'report-bdtmsds + populate=* (wildcard)',
    path: '/api/report-bdtmsds?populate=*',
  },
  {
    label: 'report-ghs + populate=* (wildcard)',
    path: '/api/report-ghs?populate=*',
  },
];

describe('AC-23: populate cannot leak other accounts', () => {
  let userA;

  before(async () => {
    userA = await loginFromEnv('USER_A_IDENTIFIER', 'USER_A_PASSWORD');
  });

  for (const attempt of LEAK_ATTEMPTS) {
    test(`AC-23: ${attempt.label} — no user/email/username fields in output`, async () => {
      const res = await apiGet(userA.jwt, attempt.path);
      // SAFE if rejected outright (4xx — e.g. the populate names a `private`
      // relation, which validateQuery rejects with a 400) OR a 200 with no
      // forbidden fields. A rejection returns no data, so it satisfies the
      // no-leak invariant just as a clean 200 does. (`populate=*` still 200s and
      // is scanned; the owned-detail test below asserts a real 200 is clean.)
      const safe = res.status === 200 || (res.status >= 400 && res.status < 500);
      assert.ok(
        safe,
        `expected 200 or a safe 4xx rejection for ${attempt.path}, got ${res.status}: ${res.raw}`,
      );

      const keyHits = findForbiddenKeys(res.body, FORBIDDEN_KEYS);
      assert.deepEqual(
        keyHits,
        [],
        `populate leak: forbidden keys present in ${attempt.label}: ${JSON.stringify(keyHits)}`,
      );

      const emailHits = findEmailLikeStrings(res.body);
      assert.deepEqual(
        emailHits,
        [],
        `populate leak: email-like strings present in ${attempt.label}: ${JSON.stringify(emailHits)}`,
      );
    });
  }

  test('AC-23: detail view of an OWNED property still excludes users/email', async () => {
    // Find an owned property, then fetch its detail with a hostile populate.
    const list = await apiGet(userA.jwt, '/api/properties?sort=order:asc');
    assert.equal(list.status, 200, list.raw);
    const first = (list.body?.data ?? [])[0];
    const ownedId = first?.documentId ?? first?.attributes?.documentId;
    assert.ok(ownedId, 'seed data must assign at least one property to User A');

    const detail = await apiGet(
      userA.jwt,
      `/api/properties/${encodeURIComponent(ownedId)}?populate[users]=*&populate[reports_ghs][populate][properties][populate][users]=*`,
    );
    assert.equal(detail.status, 200, `owned detail got ${detail.status}: ${detail.raw}`);

    const keyHits = findForbiddenKeys(detail.body, FORBIDDEN_KEYS);
    assert.deepEqual(keyHits, [], `owned-detail populate leaked: ${JSON.stringify(keyHits)}`);
    const emailHits = findEmailLikeStrings(detail.body);
    assert.deepEqual(emailHits, [], `owned-detail leaked email-like strings: ${JSON.stringify(emailHits)}`);
  });
});
