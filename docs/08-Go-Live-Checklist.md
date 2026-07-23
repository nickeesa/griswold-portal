# 08 — Production Go-Live Checklist

Operational checklist for deploying the portal to production. Complements
`05-Setup-and-Deployment.md` (full setup detail).

> **Kit vs. companion — read before checking anything off.** This repository ships
> `strapi/` as a **drop-in kit** (schema/controller/route/service source files, a boot
> guard `src/index.js`, `VERSION`, `scripts/seed.js`) — it is **not** a runnable Strapi
> project (no `package.json`; `package-lock.json` is an intentionally empty stub) and it
> does **not** ship a `config/database.*` file. That lives
> only in the companion `griswold-strapi` deployment repo that this kit is overlaid onto.
> Items below marked **[companion]** are enforced/verified in that deployed backend, not
> in this repo — do not expect to find the referenced file here. Items marked **[kit]**
> are shipped in `strapi/` in this repo and can be verified by reading this repo.
> Several requirements below are **enforced at boot** by whichever backend is actually
> running — confirm the running instance has picked up the guard, not just that the
> source file exists.

## A. Backend (Strapi Cloud / host)

- [ ] **[companion] Database = postgres, not sqlite.** The deployed backend's
      `src/index.ts` `register()` throws on `DATABASE_CLIENT=sqlite` in production (sqlite on
      an ephemeral host loses all data on redeploy — the cause of the earlier data loss).
      This guard is **not part of this repo's `strapi/` kit** — confirm it is present in
      whatever backend project (companion repo or your own assembly) you actually deploy.
- [ ] **[companion] DB TLS on.** Set `DATABASE_SSL=true` (and
      `DATABASE_SSL_REJECT_UNAUTHORIZED=false` only for a self-signed cert). The deployed
      app should refuse to boot in production without it (companion-repo guard).
- [ ] **[companion] DB credentials set.** `DATABASE_URL` *or* `DATABASE_USERNAME` +
      `DATABASE_PASSWORD` (no fallback to the default `strapi`/`strapi` in production).
- [ ] **[kit] Real secrets generated** (NOT the `.env.example` placeholders): `APP_KEYS`,
      `JWT_SECRET`, `ADMIN_JWT_SECRET`, `API_TOKEN_SALT`, `TRANSFER_TOKEN_SALT`,
      `ENCRYPTION_KEY`. This kit's `strapi/src/index.js` `register()` refuses to boot in
      production if any is unset or still a placeholder — **provided `index.js` (or its
      `register`/`bootstrap` bodies) has actually been merged into the deployed backend's
      `src/index.{js,ts}`**; copying `strapi/src/**` alone doesn't guarantee that unless
      it lands at that exact path. Generate values with `openssl rand -base64 32`.
- [ ] **[kit] `client` role exists** with least-privilege `find`/`findOne` on Property,
      both report types, and Location — and **no write permissions** (docs/05 §1). This
      kit's `bootstrap()` (`strapi/src/index.js`) audits and grants the reads, and logs a
      loud error if any write permission is present, on whichever backend it's merged into.
- [ ] **[kit] Strapi version pinned and evidenced.** `strapi/VERSION` documents the
      required floor (**Strapi ≥ 5.37.0**) and the reproducible pin (**5.37.0**) used to
      validate the access-control suite. A fresher minor (e.g. 5.50.x) is known to reject
      the legacy `publicationState` query key with HTTP 400.
      Record the **exact deployed version** (e.g. from the admin panel or `npm ls @strapi/strapi`
      in the deployed backend) as release evidence — this cannot be verified from this
      repo alone (`strapi/package-lock.json` is an empty stub, not a real lockfile).
- [ ] **[companion] Real client accounts provisioned** (NOT the seed fixtures): create
      each client user, `confirmed=true`, `blocked=false`, assigned only their own
      properties. This kit's `scripts/seed.js` fixtures are for the access-control suite
      only and must never be relied on in production.
- [ ] **[kit] JWT lifetime.** Default `JWT_EXPIRES_IN=7d`; for confidential data consider
      `1d`. Keep in lockstep with the frontend `SESSION_MAX_AGE_SECONDS` (Tech Spec §3.5, M12).
- [ ] **[kit] CORS.** `PROD_ORIGIN` in `config/middlewares.js` (merged from this kit's
      `strapi/config/middlewares.example.js`) = the real portal domain; confirm the Vercel
      preview regex slug. localhost is auto-excluded in production.
- [ ] **[companion] Transfer tokens.** Do not issue/expose Strapi transfer tokens unless
      you actively use remote data transfer (the `@strapi/data-transfer` WS endpoint is the
      one transfer-token-gated surface).
- [ ] **Media provider.** Confidential PDFs are served through the authenticated frontend
      proxy; confirm the upload provider isn't serving guessable public URLs (Tech Spec §3.8,
      M3 — the proxy protects the *href*, not the underlying file bytes; a raw upload URL
      is still fetchable by anyone who has it).
- [ ] **[kit→CI] CI tests this kit, not just the companion.** Confirm `.github/workflows/ci.yml`
      overlays `strapi/src`, `strapi/config`, and `strapi/scripts` onto the cloned companion
      backend **before** install/seed, so the access-control gate exercises the controllers
      that ship from this repo (not only whatever is already in the companion). Green CI
      without this overlay does not prove this kit's code is what was tested.

## B. Frontend (Vercel)

- [ ] **`STRAPI_URL`** set (server-only — **no** `NEXT_PUBLIC_` prefix).
- [ ] **`SESSION_COOKIE_NAME`** set and matching across login/logout/middleware.
- [ ] **`SESSION_MAX_AGE_SECONDS`** set in lockstep with the backend `JWT_EXPIRES_IN`.
- [ ] **HTTPS only.** The session cookie is `Secure` — it is only sent over HTTPS, so the
      production domain must be HTTPS (it won't work over plain HTTP).
- [ ] Production domain + DNS configured; Vercel project slug matches the CORS regex.

## C. CI / repo

- [ ] `GRISWOLD_STRAPI_DEPLOY_KEY` secret present (read-only deploy key) so the
      self-contained access-control gate can run.
- [ ] **Both** `Frontend — typecheck & build` and `Access-control suite (release blocker)`
      set as **required status checks** on `main`/`production`.
- [ ] Dependabot PRs reviewed regularly (`.github/dependabot.yml`).

## D. Pre-launch verification

- [ ] Access-control suite green (the self-contained CI gate, which overlays this kit's
      `strapi/src`+`config`+`scripts` onto the companion backend before running — see §A —
      or run it directly against the prod-seeded instance per `tests/access-control/README.md`).
- [ ] **AC-5 manual check** — DevTools: the JWT is in an `HttpOnly` cookie and not readable
      via `document.cookie`, and never appears in the page source / client bundle.
- [ ] Smoke test as a real client: log in → see only your properties → open one →
      download a report → confirm a 404 on a property you don't own → log out.
- [ ] **★ AC-4 kill-switch — MANDATORY release blocker, not optional.** `RUN_AC4=1` is
      never exercised by the CI gate (it needs an admin to flip `blocked` mid-run — see
      `.github/workflows/ci.yml` and `tests/access-control/ac-04-blocked-killswitch.test.mjs`),
      so it has **no automated regression net**. Before every production deploy:
      1. Pick or create a throwaway client account with at least one assigned property.
      2. Confirm a baseline authenticated request for that user returns **200**.
      3. Flip `blocked = true` for that account in the admin panel (or DB).
      4. Re-run the same request (or `RUN_AC4=1 node --test tests/access-control/ac-04-blocked-killswitch.test.mjs`)
         and confirm it is now **rejected** (401/403) on the very next request — not just
         after token expiry.
      5. **Record the evidence** (timestamp, account used, before/after status codes,
         who ran it) in the release notes/deploy ticket. A deploy with no recorded AC-4
         evidence is **not release-ready**, even if every automated check is green.

## E. Rollback

- [ ] Vercel: redeploy the previous production deployment (instant rollback).
- [ ] Strapi: redeploy the previous image/build; **postgres persists data** across
      redeploys (unlike the old sqlite setup), so a rollback does not lose client data.
- [ ] Keep the prior known-good commit tagged for a fast `git revert`/redeploy.

## F. Audit remediation progress (branch `alexey`)

Code/docs remediations from the consolidated counsel audit.

**Done on `alexey` (verify merged before treating as live):**

- [x] CI overlays this repo's `strapi/` kit onto companion before AC suite (**C1**)
- [x] Kit ships `strapi/src/index.js` + `strapi/VERSION`; AC-24 version-tolerant (**C2** kit-side)
- [x] F10 download-proxy unit tests in CI (**C3**)
- [x] Property list pagination (**H2**); login rate limit (**M1**); ESLint gated
- [x] Docs/PRD/tech-spec/go-live kit boundaries + Looker/`property_info` (**H3**, **M5**)
- [x] AC-4 documented as mandatory release evidence (**M2** process — still run manually in §D)

**Still open before honest release sign-off:**

- [ ] Record **exact deployed Strapi version** (≥5.37.0) in the release dossier (**C2** evidence)
- [ ] Confirm CORS from `middlewares.example.js` is merged into the **live** companion middlewares
- [ ] Execute and attach **AC-4** evidence per §D (mandatory)
- [ ] Media provider confidentiality beyond proxy href (**M3**) — if required for go-live
- [ ] Deferred: report-type consolidation (**H1**), controller factory (**M4**), AC-2 vacuity (**M7**)
