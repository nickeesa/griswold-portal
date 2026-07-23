# Griswold Hospitality — Client Portal: Build Package

Deliverables for the **Luxury Hotel Audit Client Portal** (Strapi 5 + Next.js 15 + Vercel).
For the development team. This package contains the detailed specification, the drop-in
Strapi 5 backend, a reference Next.js 15 frontend implementation, an access-control test
suite, and the operations docs (admin runbook + setup/deployment).

| | |
| :-- | :-- |
| **Client** | Griswold Hospitality |
| **Version** | 2.0 |
| **Date** | June 4, 2026 |
| **Portal URL** | client.griswoldhospitality.com |

## Contents

```
griswold-portal/
├── docs/
│   ├── 01-PRD.md               Product Requirements (what & why; source of truth)
│   ├── 03-Technical-Spec.md    Architecture, security, full reference code, deployment
│   ├── 04-Admin-Runbook.md     Operator procedures (create user, reset, revoke, publish)
│   ├── 05-Setup-and-Deployment.md  client role + permissions, CORS, env, release/rollback
│   ├── 08-Go-Live-Checklist.md  Production go-live checklist (kit vs companion; AC-4 evidence)
│   └── 09-Frontend-Design-System.md  Shipped visual system reference (tokens, screens, helpers)
├── strapi/                     Drop-in Strapi 5 **kit** — source files only, not a
│   │                           runnable app (no `package.json`; see "Kit vs. companion" below)
│   ├── VERSION                 Documents the required floor (≥ 5.37.0) and the pin used
│   │                           to reproduce a green access-control run (5.37.0)
│   ├── src/index.js            Boot guard (refuses prod boot on placeholder secrets) +
│   │                           `client`-role permission audit — merge into the deployed
│   │                           backend's `src/index.{js,ts}`
│   ├── config/
│   │   ├── plugins.js                   JWT expiry = 7 days
│   │   └── middlewares.example.js       CORS reference — MERGE into your middlewares.js
│   ├── scripts/seed.js                  Seeds the access-control test fixtures
│   └── src/api/
│       ├── property/...                 schema + scoped controller + route + service
│       ├── report-bdtmsd/...            schema + scoped controller + route + service
│       ├── report-gh/...                schema + scoped controller + route + service
│       ├── location/...                 schema + scoped controller + route + service
│       └── extensions/users-permissions/content-types/user/schema.json
├── frontend/                   Reference Next.js 15 (App Router) implementation, restyled
│   │                           per doc 09 (Tailwind + shadcn/ui over the unchanged
│   │                           server-rendered, ownership-scoped data layer)
│   ├── app/                    login, route handlers, RSC pages, proxy download
│   ├── components/             LoginForm, PropertyGrid/Card, TabBar, Reports/Performance tabs
│   ├── lib/                    strapi fetch, session, reports util, embed guards, types
│   └── middleware.ts           route guard (UX redirect only — not the boundary)
├── tests/                       Runnable release-blocker suites (node --test, zero deps)
│   ├── access-control/          AC-1–AC-4, AC-23, AC-24 (API-level; needs a live Strapi)
│   └── download-proxy/          F10 pure-helper unit tests (no live server needed)
└── .github/workflows/ci.yml    CI: frontend typecheck/lint/build; access-control suite
                                 (overlays this kit onto the companion backend — C-DUAL fix)
```

### Kit vs. companion — read before deploying

This repo's `strapi/` is a **drop-in kit** (schema, controllers, routes, services, a boot
guard, a version pin) meant to be copied into a real Strapi 5 project — it is **not**
itself a deployable backend. The actual production/staging Strapi instance lives in the
companion `griswold-strapi` repo (or whatever project you assemble by overlaying this
kit). Concretely:

- **Ships here (`strapi/`):** content-type schemas, the four scoped controllers/routes/services,
  `config/plugins.js` (JWT expiry), `config/middlewares.example.js` (CORS reference),
  `src/index.js` (boot guard + role audit), `VERSION` (version pin/floor), `scripts/seed.js`.
- **Does not ship here:** a `package.json`/real lockfile for `strapi/` (do not `npm ci`
  there — see `strapi/package-lock.json`), the production DB guards (sqlite/TLS/credential —
  companion-owned, in the companion's `src/index.ts` `register()`). Those exist only in the
  companion deployment repo. Don't assume a file mentioned in the docs is present here
  unless you can find it under `strapi/`.
- **CI overlays the kit onto the companion.** `.github/workflows/ci.yml` clones the
  companion backend, then copies this repo's `strapi/src`, `strapi/config`, and
  `strapi/scripts` on top before installing/seeding — so the access-control gate exercises
  *this repo's* controllers, not just whatever the companion already had. See
  `docs/08-Go-Live-Checklist.md` §A for the release-time version and boot-guard checks this
  implies.

## Read in this order

1. **01-PRD.md** — product picture: personas, functional/non-functional requirements
   (with IDs), data dictionary, user flows, decision log, glossary. Note §16 (corrections
   to the source docs) and the redesign note in §7.3/DD-10 (performance fields hold Looker
   embed URLs, not plain prose — see doc 09).
2. **03-Technical-Spec.md** — how to build it: architecture and request lifecycle, the
   security model (§3.3 — read twice), full reference implementations (auth, middleware,
   pages, reports util, secure proxy download), API contracts, CORS, deployment, and the
   testing/security checklist.
3. **08-Go-Live-Checklist.md** and **09-Frontend-Design-System.md** — the operational
   go-live gate and the shipped visual-system reference; read
   **09-Frontend-Design-System.md** before touching `frontend/` UI.

Requirement IDs trace across the core docs: PRD `FR-x` → `AC-x` acceptance criteria → Tech Spec
sections. Before a production deploy, also read `08-Go-Live-Checklist.md` in full — it is
the authoritative kit-vs-companion boundary doc and makes the AC-4 kill-switch check a
**mandatory** (not optional) release gate with recorded evidence.

## Using the Strapi files

Copy `strapi/src` and `strapi/config` into the Strapi 5 project and restart — the content
types build automatically and the User extension adds `full_name` + `properties`. Then:
1. Create the single `client` role with `find`/`findOne` on Property, both report types,
   and Location (Location read is required for population and is scoped by its controller —
   Technical Spec §3.4).
2. Add the CORS config: merge `strapi/config/middlewares.example.js` into the project's
   existing `config/middlewares.js` (Technical Spec §3.6). It is shipped as an `.example`
   — not a drop-in — because it would otherwise override the project's middleware order.

Each API ships a default core **service** (`createCoreService`) alongside its schema,
controller, and route. The scoped controllers call `strapi.service(UID).find(...)`
directly, so the service file must be present — without it `strapi.service()` is
`undefined` and the controller returns HTTP 500.

> **If your Strapi project is TypeScript** (the `create-strapi-app` default), set
> `"allowJs": true` in `tsconfig.json` so these `.js` files compile into `dist/`.
> Otherwise only the `schema.json` files are copied, the controllers/routes/services
> never load, and the content-API routes return 404. (Alternatively, rename the
> shipped `.js` files to `.ts`.)
>
> **Auth rate limit:** `config/plugins.js` keeps the strict production default
> (10 login requests / 60s) but disables it outside production so the access-control
> suite's rapid logins don't hit a 429. Never disable it in production.

The scoped controllers (`property.js`, `report-bdtmsd.js`, `report-gh.js`, `location.js`)
are the security boundary — **do not weaken them**. Full setup (role, permissions, env,
deployment) is in `docs/05-Setup-and-Deployment.md`.

The four routers are registered **read-only** (`only: ['find', 'findOne']`), so
`create`/`update`/`delete` are not exposed at all — a client can never mutate audit data,
and write protection does not rely solely on the admin-configured role. This kit ships
`strapi/src/index.js` as the drop-in boot guard: `register()` refuses to boot in
production with placeholder/missing secrets, and `bootstrap()` audits the `client` role's
permissions (grants missing reads, logs loudly on any write permission). If the target
Strapi project already has a non-empty `src/index.{js,ts}`, **merge** the `register`/
`bootstrap` bodies rather than overwriting it — `strapi/src/index.example.js` is kept as
the annotated reference copy of the same logic for that merge.

## Using the frontend

`frontend/` is a complete reference Next.js 15 (App Router) implementation of Technical
Spec §4. To run it:
1. `cd frontend && npm install`
2. Copy `.env.example` to `.env.local` and set `STRAPI_URL` (server-only — **no**
   `NEXT_PUBLIC_` prefix) and `SESSION_COOKIE_NAME`. Optionally set
   `SESSION_MAX_AGE_SECONDS` to keep the cookie lifetime in lockstep with the Strapi
   `JWT_EXPIRES_IN` (both default to 7 days).
3. `npm run dev` (or `npm run build`). `npm run typecheck` runs `tsc --noEmit`.

It builds clean (`next build`, all routes) and the JWT lives only in an httpOnly cookie.
Styling in `app/globals.css` is a minimal token-based foundation for the design team to
replace via the Figma → code workflow (Technical Spec §7).

## Running the access-control tests

`tests/access-control/` is the release-blocker suite (AC-1–AC-4, AC-23, AC-24) — plain
`node --test`, zero dependencies. Seed two client users with **disjoint** properties, set
the env vars in `tests/access-control/.env.example`, then `cd tests/access-control && npm
test`. The suite fails loudly (non-zero exit) if seed env is missing, so it can never pass
green without real data. AC-4 (blocked kill switch) is opt-in (`RUN_AC4=1`) since it needs
an admin to toggle `blocked` mid-run. See its `README.md`. A passing run is required before
every deploy.

To create the fixtures the suite expects (two users with disjoint properties, reports, one
unowned property, one draft property), run `strapi/scripts/seed.js` against a dev Strapi
(see `strapi/scripts/README.md`). CI is wired in `.github/workflows/ci.yml`: the frontend
typecheck + build run on every push/PR; the access-control suite is **self-contained** — it
clones the companion `griswold-strapi` backend, seeds it on sqlite, serves it, and runs the
suite against `localhost`, so the gate is reliable on every PR/push with no dependency on an
external instance. It authenticates with a read-only deploy key for `nickeesa/griswold-strapi`
whose private half is stored as the `GRISWOLD_STRAPI_DEPLOY_KEY` Actions secret.

## Running the F10 download-proxy tests

`tests/download-proxy/` covers the release-blocker F10 gate (confidential PDF downloads):
ownership recheck, SSRF origin pinning, `Sec-Fetch-Site` cross-site rejection, and filename
sanitization, exercised as pure-function unit tests that **import the shipped helpers** from
`frontend/lib/download-proxy.mjs` — the same module the download route uses — so a regression
in shipped code fails the gate. No live Strapi/Next server is needed. Run with
`node --test tests/download-proxy/*.test.mjs` from the repo root; CI runs this alongside the
frontend typecheck/build job.

## Corrections & hardening applied vs. the source documents

From reconciling the source docs and an independent technical validation:

1. Strapi passwords are hashed and **cannot be viewed or recovered** after saving —
   reset means setting a new password, not "looking up the old one."
2. My Properties uses the guarded `/api/properties` endpoint, **not** `users/me`
   deep-populate (which Strapi does not reliably support).
3. Access control is enforced **server-side**, not in the frontend.
4. Ownership checks are pinned to **published** status (the raw Document Service defaults
   to draft) so the check matches the data served.
5. CORS uses a **function-based origin** (a literal `*.vercel.app` string never matches).
6. Controllers constrain **populate** server-side (not just filters) and never populate
   `users`, closing a relation-population leak path. `?status=draft` is overridden.
7. The `client` role also gets **scoped** read access to Location (needed for population).
8. **Minimum versions pinned:** Strapi ≥ 5.37.0, Next.js ≥ 15.2.3 (security fixes).
9. The **`blocked` kill switch** is confirmed to act on every request (per-request DB
   check), not only at login.
10. **JWT lifetime** (7 days) is flagged for reduction to ≤ 1 day + refresh for
    confidential data; kept at 7 days only as a documented accepted risk.

All are handled throughout the docs and shipped code.

## Review hardening (post-delivery)

Defense-in-depth applied after an independent review, on top of the already-correct
read-scoping boundary:

1. **Routers are read-only** (`only: ['find','findOne']`) — `create`/`update`/`delete`
   are no longer routable; write protection no longer rests solely on role config.
2. **Schema-level backstop:** `Property.users` and the reports' `properties` relations
   are marked `"private": true`, so they can never be serialized even if a future
   populate slips — the controller allow-lists stay the first line of defense.
3. **Production fail-fast guards:** this kit's `src/index.js` refuses to boot with
   placeholder/missing security secrets (`APP_KEYS`, `JWT_SECRET`, `ADMIN_JWT_SECRET`,
   `API_TOKEN_SALT`, `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY`). The DB-TLS / postgres-only /
   default-credential-rejection guards described in `docs/08-Go-Live-Checklist.md` §A are
   **companion-owned** and live in the companion's `src/index.ts` `register()` (not a
   `config/database.*` file) — they are not part of this kit and are not verifiable from
   this repo alone. When assembling a backend from this kit, port those DB guards into
   your project's `register()` as well (see companion `griswold-strapi/src/index.ts`).
4. **Frontend leak fix:** report rows are mapped to view models **server-side**, so the
   raw Strapi media URL never enters the client RSC payload (only the proxy href does).
5. **Download proxy** is constrained to the Strapi origin (no SSRF) and rejects cross-site
   requests (`Sec-Fetch-Site`).
6. **CI gate** fails (not skips) on protected-branch pushes when the AC secrets are absent;
   the access-control suite gained minimum-cardinality assertions and an absolute draft
   check so a deny-all/empty result can't pass green.
7. **Tunable session:** JWT lifetime (`JWT_EXPIRES_IN`) and cookie maxAge
   (`SESSION_MAX_AGE_SECONDS`) are env-configurable and documented to tighten to ≤ 1 day.
8. **Seed** reads passwords from env (no committed credentials), refuses to run in
   production without an explicit flag, repairs report→property links authoritatively, and
   creates a draft fixture for the AC-24 absolute check.
