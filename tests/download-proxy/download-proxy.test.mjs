// F10 download-proxy unit tests (zero-dep node:test).
// Exercises the pure helpers used by the Next download route — ownership status
// mapping, Sec-Fetch-Site CSRF, SSRF origin pin, filename sanitization.
//
// These import the SHIPPED helpers directly from frontend/lib/download-proxy.mjs
// — the exact module the download route uses — so a regression in shipped code
// (e.g. inverting the SSRF origin pin, or making isAllowedSecFetchSite always
// return true) fails this release-blocker gate. No inline mirror to drift.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedSecFetchSite,
  mapOwnershipStatus,
  resolveStrapiMediaUrl,
  sanitizeDownloadBasename,
  extensionFromFileUrl,
} from '../../frontend/lib/download-proxy.mjs';

describe('F10 download proxy helpers', () => {
  test('unowned / missing property → 404', () => {
    assert.equal(mapOwnershipStatus(404), 404);
  });

  test('auth failure maps 401 and 403 (not 500)', () => {
    assert.equal(mapOwnershipStatus(401), 401);
    assert.equal(mapOwnershipStatus(403), 403);
  });

  test('success proceeds (null); other errors → 500', () => {
    assert.equal(mapOwnershipStatus(200), null);
    assert.equal(mapOwnershipStatus(204), null);
    assert.equal(mapOwnershipStatus(502), 500);
    assert.equal(mapOwnershipStatus(500), 500);
  });

  test('Sec-Fetch-Site cross-site → forbidden; same-site/none/missing ok', () => {
    assert.equal(isAllowedSecFetchSite('cross-site'), false);
    assert.equal(isAllowedSecFetchSite('same-origin'), true);
    assert.equal(isAllowedSecFetchSite('same-site'), true);
    assert.equal(isAllowedSecFetchSite('none'), true);
    assert.equal(isAllowedSecFetchSite(null), true);
  });

  test('SSRF: off-origin absolute URL → null (caller 404s)', () => {
    assert.equal(
      resolveStrapiMediaUrl('https://evil.example/pwn.pdf', 'https://strapi.example'),
      null,
    );
  });

  test('SSRF: same-origin absolute + relative paths resolve', () => {
    assert.equal(
      resolveStrapiMediaUrl('https://strapi.example/uploads/a.pdf', 'https://strapi.example'),
      'https://strapi.example/uploads/a.pdf',
    );
    assert.equal(
      resolveStrapiMediaUrl('/uploads/a.pdf', 'https://strapi.example'),
      'https://strapi.example/uploads/a.pdf',
    );
  });

  test('SSRF: Strapi Cloud media subdomain is trusted; unrelated subdomain is not', () => {
    assert.equal(
      resolveStrapiMediaUrl(
        'https://mighty-triumph-511acae1a4.media.strapiapp.com/report.pdf',
        'https://mighty-triumph-511acae1a4.strapiapp.com',
      ),
      'https://mighty-triumph-511acae1a4.media.strapiapp.com/report.pdf',
    );
    assert.equal(
      resolveStrapiMediaUrl(
        'https://ingenious-garden-47d92e8858.media.strapiapp.com/old.pdf',
        'https://mighty-triumph-511acae1a4.strapiapp.com',
      ),
      null,
    );
  });

  test('filename sanitization strips quotes/control; preserves extension', () => {
    assert.equal(sanitizeDownloadBasename('Q4 "Audit"'), 'Q4 _Audit_');
    assert.equal(extensionFromFileUrl('/uploads/x.PNG?v=1'), '.PNG');
    assert.equal(extensionFromFileUrl('/uploads/noext'), '.pdf');
  });
});
