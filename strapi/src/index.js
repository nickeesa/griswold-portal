'use strict';

/**
 * ============================================================================
 *  DROP-IN BOOT GUARD — ship as `src/index.js` when assembling from this kit.
 *
 *  If the companion Strapi project already has a non-empty `src/index.js`,
 *  MERGE the `register` and `bootstrap` bodies below into those hooks instead
 *  of blindly overwriting project-specific register/bootstrap logic.
 *
 *  `index.example.js` is kept as the annotated reference copy of the same logic.
 * ============================================================================
 *
 * What it adds (defense-in-depth, Technical Spec §3.3/§3.4):
 *   - register(): refuses to boot in PRODUCTION if any security-critical secret
 *     is unset or still the .env.example placeholder. JWT_SECRET signs the client
 *     session JWT that every ownership check trusts, so a known value defeats the
 *     whole boundary. NOTE: the production DATABASE guards (reject sqlite in
 *     prod, require DATABASE_SSL, reject default DB credentials) are companion-
 *     owned and live in the companion's src/index.ts register() — NOT in this
 *     kit. If you assemble a backend from this kit, port those DB guards into
 *     your project's register() as well (see companion griswold-strapi/src/index.ts).
 *   - bootstrap(): audits the `client` role's permission matrix — grants the
 *     allowed read actions if missing (additive, idempotent) and raises a loud
 *     error if any WRITE permission is present. It never deletes permissions and
 *     never throws: the read-only routers (only: ['find','findOne']) are the hard
 *     guarantee, so this audit must not be able to cause an outage.
 * ============================================================================
 */

const CLIENT_READ_UIDS = [
  'api::property.property',
  'api::report-bdtmsd.report-bdtmsd',
  'api::report-gh.report-gh',
  'api::location.location',
];
const READ_ACTIONS = ['find', 'findOne'];
const WRITE_ACTIONS = ['create', 'update', 'delete'];

const REQUIRED_PROD_SECRETS = [
  'APP_KEYS',
  'JWT_SECRET',
  'ADMIN_JWT_SECRET',
  'API_TOKEN_SALT',
  'TRANSFER_TOKEN_SALT',
  'ENCRYPTION_KEY',
];
const PLACEHOLDERS = new Set([
  'tobemodified',
  'toBeModified1,toBeModified2',
  'toBeModified1',
  'toBeModified2',
]);

module.exports = {
  register() {
    if (process.env.NODE_ENV !== 'production') return;
    const offenders = REQUIRED_PROD_SECRETS.filter((key) => {
      const val = process.env[key];
      return !val || PLACEHOLDERS.has(val.trim());
    });
    if (offenders.length) {
      throw new Error(
        `Refusing to boot in production: these secrets are unset or still at their ` +
          `.env.example placeholder: ${offenders.join(', ')}. Generate strong random ` +
          `values (docs/05 §3) before deploying.`,
      );
    }
  },

  async bootstrap({ strapi }) {
    try {
      const role = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: 'client' } });
      if (!role) {
        strapi.log.warn(
          "[client-role audit] No `client` role found (type: 'client'). Create it " +
            'before serving clients — docs/05 §1.',
        );
        return;
      }

      const permissionQuery = strapi.query('plugin::users-permissions.permission');
      const existing = await permissionQuery.findMany({ where: { role: role.id } });
      const enabled = new Set(existing.map((p) => p.action));

      for (const uid of CLIENT_READ_UIDS) {
        for (const action of READ_ACTIONS) {
          const fullAction = `${uid}.${action}`;
          if (!enabled.has(fullAction)) {
            await permissionQuery.create({ data: { action: fullAction, role: role.id } });
            strapi.log.info(`[client-role audit] granted ${fullAction}`);
          }
        }
      }

      const forbidden = new Set(
        CLIENT_READ_UIDS.flatMap((uid) => WRITE_ACTIONS.map((a) => `${uid}.${a}`)),
      );
      const offending = existing.map((p) => p.action).filter((a) => forbidden.has(a));
      if (offending.length) {
        strapi.log.error(
          `[client-role audit] SECURITY: the 'client' role has write permissions it must ` +
            `not have: ${offending.join(', ')}. Revoke them in Settings → Roles → client. ` +
            `(Routes are read-only, so these are not routable today, but fix the role.)`,
        );
      }
    } catch (err) {
      strapi.log.error(
        `[client-role audit] skipped due to error: ${(err && err.message) || err}`,
      );
    }
  },
};
