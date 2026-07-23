'use strict';

/**
 * Seed script — access-control test fixtures for the Griswold client portal.
 *
 * Produces exactly what tests/access-control expects:
 *   - 1 Location
 *   - 3 published Properties (P1 + P2 owned by User A; P9 owned by User B / unowned-by-A)
 *   - 1 DRAFT property owned by User A (must never surface via the API — powers AC-24)
 *   - 1 Reports-BDTMSD + 1 Reports-GH for User A's set, and the same for User B's
 *   - 2 client Users with DISJOINT property assignments
 *   - all read-fixtures PUBLISHED; each report gets a small placeholder PDF (best effort)
 * Then prints the env block for tests/access-control/.env.
 *
 * HOW TO RUN (from the Strapi PROJECT root, after copying strapi/src + strapi/config
 * in and starting Strapi at least once so the content types exist):
 *
 *   SEED_USER_A_PASSWORD=... SEED_USER_B_PASSWORD=... node ./scripts/seed.js
 *
 * Passwords are read from the environment — there is NO default. The script also
 * refuses to run when NODE_ENV=production unless SEED_ALLOW_PRODUCTION=1 is set.
 *
 * Idempotent: re-running matches existing records by natural key (username /
 * property name / report type+date) and repairs relations rather than duplicating.
 *
 * PREREQUISITE: the `client` role must already exist with find/findOne on
 * Property, both report types, and Location (docs/05 §1). This script looks it
 * up and aborts with a pointer if it's missing — it does NOT set permissions.
 *
 * ⚠ NOT EXECUTED in the delivery environment. The relation-connect and
 * users-permissions service signatures shift between Strapi 5 minors — review
 * against your installed version before trusting it on real data. Run it
 * against a DEV database first, never production.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const UID = {
  location: 'api::location.location',
  property: 'api::property.property',
  bdtmsd: 'api::report-bdtmsd.report-bdtmsd',
  gh: 'api::report-gh.report-gh',
  user: 'plugin::users-permissions.user',
};

// ---- Seed credentials (test-only, from env — no insecure default) ----
const PW_A = process.env.SEED_USER_A_PASSWORD;
const PW_B = process.env.SEED_USER_B_PASSWORD;

const SEED = {
  location: { name: 'Kailua-Kona, Hawaii' },
  properties: {
    P1: { name: 'Four Seasons Hualalai', order: 0 },
    P2: { name: 'Mauna Lani Auberge', order: 1 },
    P9: { name: 'Halekulani Waikiki', order: 0 }, // User B's — unowned by A
  },
  // Draft property owned by User A — never published, so it must never be served.
  draft: { name: 'DRAFT — Unpublished Audit Property', order: 99 },
  userA: { username: 'seed_clienta', email: 'seed-clienta@noreply.griswoldhospitality.com' },
  userB: { username: 'seed_clientb', email: 'seed-clientb@noreply.griswoldhospitality.com' },
};

async function main() {
  // Guards (fail fast, before booting Strapi).
  if (!PW_A || !PW_B) {
    throw new Error(
      'Set SEED_USER_A_PASSWORD and SEED_USER_B_PASSWORD (strong, throwaway test ' +
        'credentials) in the environment before running the seed.',
    );
  }
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== '1') {
    throw new Error(
      'Refusing to seed test fixtures with NODE_ENV=production. Set SEED_ALLOW_PRODUCTION=1 ' +
        'only if you genuinely intend to write seed accounts to this database.',
    );
  }

  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';

  try {
    // 0) client role must exist (we never configure permissions here).
    const role = await app.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'client' },
    });
    if (!role) {
      throw new Error(
        "No `client` role found (type: 'client'). Create it first — docs/05 §1 — then re-run.",
      );
    }

    // 1) Location.
    const location = await ensureByField(app, UID.location, 'name', SEED.location.name, {
      name: SEED.location.name,
    });

    // 2) Properties (link location by documentId).
    const p1 = await ensureProperty(app, SEED.properties.P1, location.documentId);
    const p2 = await ensureProperty(app, SEED.properties.P2, location.documentId);
    const p9 = await ensureProperty(app, SEED.properties.P9, location.documentId);

    // 2b) Draft property owned by User A — created unpublished on purpose.
    const draft = await ensureDraftProperty(app, SEED.draft, location.documentId);

    // 3) Reports — one of each type per owner set, published, with a placeholder PDF.
    await ensureReport(app, UID.bdtmsd, {
      type: 'Q4 2025 Luxury Audit', date: '2025-12-01', performance_score: 87.26,
    }, p1.documentId);
    await ensureReport(app, UID.gh, {
      type: 'GH Spa & Service Review', date: '2025-11-15', performance_score: 90.1, spa_score: 88.0,
    }, p1.documentId);
    await ensureReport(app, UID.bdtmsd, {
      type: 'Q4 2025 Luxury Audit', date: '2025-12-03', performance_score: 81.4,
    }, p9.documentId);
    await ensureReport(app, UID.gh, {
      type: 'GH Spa & Service Review', date: '2025-11-18', performance_score: 84.0, spa_score: 79.5,
    }, p9.documentId);

    // 4) Users with DISJOINT property sets (A: P1+P2+draft, B: P9).
    const userA = await ensureUser(app, SEED.userA, PW_A, role.id, [p1.id, p2.id, draft.id]);
    const userB = await ensureUser(app, SEED.userB, PW_B, role.id, [p9.id]);

    // 5) Print the env block for the access-control suite. Passwords are NOT
    //    printed — use the SEED_USER_*_PASSWORD values you supplied.
    /* eslint-disable no-console */
    console.log(`
✅ Seed complete.

Suggested tests/access-control/.env (adjust STRAPI_URL to your instance):

  STRAPI_URL=http://localhost:1337
  USER_A_IDENTIFIER=${userA.username}
  USER_A_PASSWORD=<the SEED_USER_A_PASSWORD you set>
  USER_B_IDENTIFIER=${userB.username}
  USER_B_PASSWORD=<the SEED_USER_B_PASSWORD you set>
  UNOWNED_PROPERTY_ID=${p9.documentId}
  DRAFT_PROPERTY_ID=${draft.documentId}

User A owns: ${p1.name} (${p1.documentId}), ${p2.name} (${p2.documentId})
            + DRAFT ${draft.name} (${draft.documentId})  <-- must never be served
User B owns: ${p9.name} (${p9.documentId})   <-- unowned by A
`);
    /* eslint-enable no-console */
  } finally {
    await app.destroy();
  }
}

// ---- helpers ----

// Find a published doc by a scalar field, or create it. Returns {id, documentId, ...}.
async function ensureByField(app, uid, field, value, data) {
  const [found] = await app.documents(uid).findMany({
    filters: { [field]: value },
    status: 'published',
    limit: 1,
  });
  if (found) return found;
  return app.documents(uid).create({ data, status: 'published' });
}

async function ensureProperty(app, { name, order }, locationDocId) {
  const [found] = await app.documents(UID.property).findMany({
    filters: { name },
    status: 'published',
    limit: 1,
  });
  if (found) return found;
  return app.documents(UID.property).create({
    data: { name, order, location: { connect: [locationDocId] } },
    status: 'published',
  });
}

// A property that is created and left in DRAFT (never published).
async function ensureDraftProperty(app, { name, order }, locationDocId) {
  const [found] = await app.documents(UID.property).findMany({
    filters: { name },
    status: 'draft',
    limit: 1,
  });
  if (found) return found;
  return app.documents(UID.property).create({
    // No `status` -> the document is created as a draft and never published.
    data: { name, order, location: { connect: [locationDocId] } },
  });
}

async function ensureReport(app, uid, fields, propertyDocId) {
  const [found] = await app.documents(uid).findMany({
    filters: { type: fields.type, date: fields.date },
    status: 'published',
    limit: 1,
  });
  if (found) {
    // Repair the linkage authoritatively: pin the report to EXACTLY the intended
    // property (`set`, not `connect`) so a pre-existing record or a stray link to
    // the other owner cannot quietly break the disjoint-ownership invariant the
    // access-control suite depends on.
    await app.documents(uid).update({
      documentId: found.documentId,
      status: 'published',
      data: { properties: { set: [propertyDocId] } },
    });
    return found;
  }
  const download = await uploadPlaceholderPdf(app, `${fields.type} ${fields.date}`);
  return app.documents(uid).create({
    data: {
      ...fields,
      full_report: 'https://reports.example.com/placeholder',
      ...(download ? { download } : {}),
      properties: { set: [propertyDocId] },
    },
    status: 'published',
  });
}

// Create the user via the users-permissions service (which hashes the password
// via the user content-type lifecycle), then set the M:N properties relation
// through the query engine (stable, numeric ids). Idempotent by username.
async function ensureUser(app, { username, email }, password, roleId, propertyIds) {
  const existing = await app.db.query(UID.user).findOne({ where: { username } });
  if (existing) {
    await app.db.query(UID.user).update({
      where: { id: existing.id },
      data: { confirmed: true, blocked: false, role: roleId, properties: propertyIds },
    });
    return existing;
  }
  const created = await app
    .plugin('users-permissions')
    .service('user')
    .add({ username, email, password, provider: 'local', confirmed: true, blocked: false, role: roleId });
  await app.db.query(UID.user).update({
    where: { id: created.id },
    data: { properties: propertyIds },
  });
  return created;
}

// Best-effort: upload a tiny valid PDF and return its media id, or null on failure.
async function uploadPlaceholderPdf(app, label) {
  const tmp = path.join(os.tmpdir(), `seed-${label.replace(/[^\w]+/g, '_')}.pdf`);
  try {
    // Minimal one-page PDF.
    const pdf =
      '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\n' +
      'trailer<</Root 1 0 R>>\n%%EOF';
    fs.writeFileSync(tmp, pdf);
    const [file] = await app
      .plugin('upload')
      .service('upload')
      .upload({
        data: {},
        files: {
          filepath: tmp,
          originalFileName: `${label}.pdf`,
          mimetype: 'application/pdf',
          size: fs.statSync(tmp).size,
        },
      });
    return file?.id ?? null;
  } catch (err) {
    app.log.warn(`Placeholder PDF upload failed (continuing without download): ${err.message}`);
    return null;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
