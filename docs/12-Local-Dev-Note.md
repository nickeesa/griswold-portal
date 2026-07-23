# Local development (post-migration)

Short note for nickeesa / Phase 4.7. No secrets in this file.

## Portal (frontend)

1. Clone `nickeesa/griswold-portal`, work in `frontend/`.
2. Copy `frontend/.env.example` → `frontend/.env.local` and set:
   - `STRAPI_URL=https://mighty-triumph-511acae1a4.strapiapp.com` (or local Strapi — see below)
   - `SESSION_COOKIE_NAME=gh_token`
   - `SESSION_MAX_AGE_SECONDS=604800` (keep aligned with Strapi `JWT_EXPIRES_IN=7d`)
3. Cookies are `Secure` in production login code. For local login that sets the session cookie, use HTTPS:

```bash
cd frontend
npm ci
npm run dev -- --experimental-https
```

Open `https://localhost:3000` (trust the Next-generated cert once).

4. Production portal: `https://griswold-portal-nine.vercel.app` (re-private the GitHub repo when Pro is paid).

## Strapi (companion) — Option A one-way pull

Use the **companion** repo `nickeesa/griswold-strapi` as local backend truth. Do **not** overwrite it with the kit under `griswold-portal/strapi/`.

**Option A (one-way pull from NEW Cloud → local):** refresh local DB from Cloud without pushing local data back.

1. Create a short-lived **Transfer token** on NEW Cloud admin (Settings → Transfer Tokens). Put it only in a temp file / prompt — never commit it.
2. From a local companion checkout with dependencies installed:

```bash
# Wipes local DB first — expected for a throwaway/dev pull
npm run strapi transfer -- --from https://mighty-triumph-511acae1a4.strapiapp.com/admin --exclude files
```

Paste the token when prompted. Media binaries are migrated manually in Cloud; excluding files avoids binary transfer issues.

3. Run local Strapi (`npm run develop`), point `frontend/.env.local` `STRAPI_URL` at `http://localhost:1337`, and use HTTPS frontend as above if you need Secure cookies against a tunnel; for pure localhost HTTP Strapi + HTTPS Next, prefer logging in against Cloud URL or adjust cookie `secure` only in local experiments (do not change Production).

## CORS

Cloud companion `PROD_ORIGIN` is the Vercel Production alias. Localhost is allowed only when Strapi `NODE_ENV` is not `production`. Preview `*.vercel.app` origins are not allowed.

## CI

Portal Actions clones companion via deploy key `GRISWOLD_STRAPI_DEPLOY_KEY`. Required checks on `main`: **Frontend — typecheck & build**, **Access-control suite (release blocker)**.

<!-- phase4 preview-disable proof PR -->

