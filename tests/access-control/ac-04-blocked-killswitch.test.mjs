// AC-4 (FR-2.5) — `blocked = true` kill switch.
//
// "Given an active client, when the admin sets blocked = true, then the client's
//  next request is rejected and they can no longer log in."
//
// Per Technical Spec §3.5, Strapi's users-permissions authenticator does a live
// DB lookup of the user on EVERY authenticated request and rejects it if
// `user.blocked` is true — so an already-issued JWT stops working immediately,
// and a fresh login is also refused.
//
// This suite CANNOT toggle `blocked` (it would require an admin API token /
// admin panel access, which is intentionally out of scope — the `client` role
// has no user-management permissions). The test is therefore OPTIONAL and
// SKIPPED unless RUN_AC4=1, and it pauses for a manual admin toggle between the
// two requests.
//
// ── MANUAL PROCEDURE ───────────────────────────────────────────────────────
//   1. Set env: RUN_AC4=1 and AC4_USER_IDENTIFIER / AC4_USER_PASSWORD to a
//      DEDICATED throwaway client account you are willing to block. (Do NOT use
//      USER_A / USER_B — blocking them breaks the other tests.)
//      Optionally set AC4_PAUSE_MS (default 30000) for how long the test waits
//      for you to flip the toggle.
//   2. Run: RUN_AC4=1 node --test ac-04-blocked-killswitch.test.mjs
//   3. The test logs in, makes a baseline /api/properties call (expects 200),
//      then PRINTS a prompt and pauses for AC4_PAUSE_MS.
//   4. While it is paused: in Strapi admin → Content Manager → Users, open the
//      AC4 user, set Blocked = true, Save. (Or via the admin REST/users-perms
//      admin endpoint with an admin token.)
//   5. The test resumes and asserts:
//        a) the SAME JWT now yields 401/403 on /api/properties (kill switch), and
//        b) a fresh POST /api/auth/local for that account now fails (cannot log in).
//   6. Afterwards, re-enable the account (Blocked = false) in admin so it can be
//      reused.
// ────────────────────────────────────────────────────────────────────────────

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { login, apiGet, requireEnv, optionalEnv } from './lib/helpers.mjs';

const ENABLED = process.env.RUN_AC4 === '1';

describe('AC-4: blocked = true kill switch (manual, optional)', { skip: !ENABLED && 'set RUN_AC4=1 and follow the manual procedure in this file' }, () => {
  test('AC-4: blocking the account rejects the in-flight JWT and blocks re-login', async () => {
    const identifier = requireEnv('AC4_USER_IDENTIFIER');
    const password = requireEnv('AC4_USER_PASSWORD');
    const pauseMs = Number(optionalEnv('AC4_PAUSE_MS', '30000'));

    // 1) Log in and confirm the token works.
    const jwt = await login(identifier, password);
    const before = await apiGet(jwt, '/api/properties');
    assert.equal(
      before.status,
      200,
      `baseline /api/properties should be 200 before blocking, got ${before.status}: ${before.raw}`,
    );

    // 2) Pause for the admin to set blocked = true.
    // eslint-disable-next-line no-console
    console.log(
      `\n[AC-4] >>> NOW set Blocked = true for "${identifier}" in Strapi admin and Save. ` +
        `Waiting ${pauseMs}ms... <<<\n`,
    );
    await sleep(pauseMs);

    // 3a) The same JWT must now be rejected (live per-request blocked check).
    const after = await apiGet(jwt, '/api/properties');
    assert.ok(
      after.status === 401 || after.status === 403,
      `blocked user's existing JWT must be rejected (401/403); got ${after.status}: ${after.raw}. ` +
        `Did you set Blocked = true and Save within the pause window?`,
    );

    // 3b) A fresh login must also fail.
    await assert.rejects(
      () => login(identifier, password),
      `blocked account must no longer be able to log in via /api/auth/local`,
    );

    // eslint-disable-next-line no-console
    console.log(
      `\n[AC-4] Kill switch verified. Remember to set Blocked = false for "${identifier}" to reuse it.\n`,
    );
  });
});
