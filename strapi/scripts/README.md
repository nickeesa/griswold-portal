# Strapi seed script

`seed.js` creates the access-control test fixtures (see `../../tests/access-control/`):
one location, three published properties, one **draft** property owned by User A (must
never surface via the API — powers AC-24's absolute check), four reports, and two `client`
users with **disjoint** property assignments — published content each with a placeholder PDF.

## Prerequisites

1. The portal backend is installed (you've copied `strapi/src` + `strapi/config` into the
   Strapi project and started it once, so the content types exist).
2. The **`client` role already exists** with `find`/`findOne` on Property, both report
   types, and Location — see `docs/05-Setup-and-Deployment.md` §1. The script looks it up
   by `type: 'client'` and aborts if missing; it does **not** configure permissions.
3. You're pointing at a **development database**, not production.

## Run

From the Strapi **project root** (where `scripts/seed.js` ends up after you copy this in).
Passwords are read from the environment — there is **no** built-in default:

```bash
SEED_USER_A_PASSWORD='...' SEED_USER_B_PASSWORD='...' node ./scripts/seed.js
```

The script refuses to run when `NODE_ENV=production` unless `SEED_ALLOW_PRODUCTION=1` is
also set. It prints a ready-to-paste env block for `tests/access-control/.env` (including
`UNOWNED_PROPERTY_ID` — one of User B's properties, which User A must not be able to read —
and `DRAFT_PROPERTY_ID`, the unpublished property owned by User A). Passwords are **not**
echoed; reuse the `SEED_USER_*_PASSWORD` values you supplied.

Optional convenience — add to the Strapi project's `package.json`:

```json
{ "scripts": { "seed": "node ./scripts/seed.js" } }
```

## Notes

- **Idempotent.** Re-running matches existing records by natural key (username, property
  name, report `type`+`date`) and refreshes relations instead of duplicating.
- **Test credentials.** Passwords come from `SEED_USER_A_PASSWORD` / `SEED_USER_B_PASSWORD`
  (no default — the script fails fast if unset) and are never printed. Use strong throwaway
  values, and change the placeholder emails for any shared environment.
- **Version sensitivity.** Relation-`connect` shapes and the users-permissions `user.add`
  service signature can change between Strapi 5 minor versions. This script uses the common
  Strapi 5 idioms (Document Service for content with `{ connect: [documentId] }`; the query
  engine for the user↔property relation with numeric ids), but **review it against your
  installed version** before running on data you care about. It was not executed in the
  environment that generated this package.
- **Placeholder PDFs** are uploaded best-effort; if the upload service signature differs,
  the script logs a warning and continues, leaving reports without a `download` file.
