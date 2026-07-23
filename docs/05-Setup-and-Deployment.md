# Luxury Hotel Audit — Client Portal
## Setup & Deployment Guide

---

### Document Control

| | |
| :-- | :-- |
| **Document** | Setup & Deployment Guide |
| **Project** | Luxury Hotel Audit — Client Portal |
| **Client** | Griswold Hospitality |
| **Version** | 2.0 |
| **Status** | For Build |
| **Date** | June 4, 2026 |
| **Related documents** | `01-PRD.md`, `03-Technical-Spec.md`, `04-Admin-Runbook.md` |
| **Ships with** | `strapi/` schema + scoped controllers + routes + `config/plugins.js`; `config/middlewares.example.js` (CORS reference — merge, don't drop in) |

> This is the first-deploy / configuration guide for the pieces the package **deliberately does not auto-ship** — the `client` role and its permissions, the CORS edit, environment variables, and the release/rollback procedure. The schema, scoped controllers, routes, and JWT config are already in `strapi/` (`03-Technical-Spec.md` Appendix A). Requirement IDs trace to `01-PRD.md` (`FR-x`) and the acceptance criteria (`AC-x`).

---

### Table of Contents
1. Create the `client` role & permissions
2. CORS — merge the example into the project's middleware
3. Environment variables checklist
4. First-deploy ordered checklist
5. Release & Rollback
6. Release-blocker gate

---

## 1. Create the `client` role & permissions
**Maps to:** `01-PRD.md` §5, FR-2; `03-Technical-Spec.md` §3.4. **Not auto-shipped** — roles/permissions live in the database, not in schema files.

After the first Strapi deploy (so the content types exist), create **one** role in **Settings → Users & Permissions Plugin → Roles → Add new role**, named **`client`**. Grant **only** `find` and `findOne` on the four content types below — nothing else.

| Content type | Permissions | Why / Notes |
| :-- | :-- | :-- |
| **Property** | `find`, `findOne` | Scoped by `property.js`. The client's primary data. |
| **Reports BDTMSD** | `find`, `findOne` | Scoped by `report-bdtmsd.js`. Defense-in-depth for direct report queries. |
| **Reports GH** | `find`, `findOne` | Scoped by `report-gh.js`. Same as above; GH carries `spa_score`. |
| **Location** | `find`, `findOne` | **Required** so `location.name` can populate on a property — Strapi gates population by the **populated type's** read permission. Scoped by `location.js` to **only the user's locations**, so this grant does **not** expose the full location list. |

**Do not grant:**
- Any `create` / `update` / `delete`, on any type (clients are read-only — `01-PRD.md` §5).
- Any access to the Users-Permissions **user** endpoints (no `/api/users`, no `users/me` write).
- Anything on the **Public** role for Property / Reports / Location — leave Public with no access.

**Leave as default:** the auth endpoints (`auth.local`, etc.) on the **Public** role, so login works (`03-Technical-Spec.md` §3.4).

> **Why Location read is safe.** Without `find`/`findOne` on Location, the property's `location` relation would not populate and clients would see no location names. With it, `location.js` applies the same ownership scoping as the property controller (filtered by the user's properties), so a client can only read locations attached to properties they are assigned. The grant enables population without widening exposure (`01-PRD.md` §16 hardening (b)).

After setting permissions, verify with a seeded test token (Milestone A exit): `GET /api/properties` returns only that user's properties; a non-owned `findOne` returns 404; `populate[users]=*` leaks no account data (AC-23); `?status=draft` returns nothing privileged (AC-24).

---

## 2. CORS — merge the example into the project's middleware
**Maps to:** `03-Technical-Spec.md` §3.6 (v2.1 corrected); Risk R7.

The repo ships **`strapi/config/middlewares.example.js`**, not a live `config/middlewares.js`. This is intentional: every Strapi project already has its own `config/middlewares.js` with the default middleware **array in a specific order**. Dropping the example in as `middlewares.js` would **override that order** and could break the project's other middleware. Instead, **merge** the CORS block from the example into the project's existing `config/middlewares.js`, replacing the existing `'strapi::cors'` entry.

**To merge:**
1. Open `strapi/config/middlewares.example.js` and the project's `config/middlewares.js` side by side.
2. Copy the `PROD_ORIGIN`, `VERCEL_PROJECT`, and `VERCEL_PREVIEW_RE` constants to the top of the project's file.
3. Replace the project's `'strapi::cors'` entry (or the bare string `'strapi::cors'`) with the configured object from the example, keeping the rest of the project's array order intact.
4. Restart Strapi.

**v2.1 project-scoped Vercel-preview regex.** The example uses a `VERCEL_PROJECT = 'griswold-portal'` slug constant and a regex anchored to it:

```js
const VERCEL_PROJECT = 'griswold-portal';
const VERCEL_PREVIEW_RE = new RegExp(`^https://${VERCEL_PROJECT}-[a-z0-9-]+\\.vercel\\.app$`);
```

This was **corrected in Tech Spec v2.1**: a bare `*.vercel.app` pattern would trust **every** Vercel customer's app. Scoping to the project slug allows **only this portal's** preview deployments.

> **Confirm the real slug.** `griswold-portal` is the assumed Vercel project slug. Check the actual slug in the Vercel dashboard (preview URLs look like `<slug>-<hash>-<team>.vercel.app`) and update `VERCEL_PROJECT` if it differs, or previews will be blocked.

The `origin` is a **function** returning a **string** (`@koa/cors` requires a string, not a boolean); for disallowed origins it returns `PROD_ORIGIN` as a **non-reflecting** safe default; `methods` are `GET`/`POST`/`OPTIONS`; `credentials` is `true`. CORS here is **defense-in-depth, not the security boundary** — the browser never calls Strapi directly; Next.js fetches server-side (`03-Technical-Spec.md` §3.6). Tighten or remove the preview pattern before launch if not needed.

---

## 3. Environment variables checklist
**Maps to:** `03-Technical-Spec.md` Appendix B, §3.9, §4.2.

### 3.1 Strapi (Strapi Cloud — set as secrets, never commit)

| Variable | Purpose |
| :-- | :-- |
| `JWT_SECRET` | Signs users-permissions JWTs (the client login token). Use a strong value. |
| `APP_KEYS` | Session / signing keys. |
| `API_TOKEN_SALT` | API token hashing. |
| `ADMIN_JWT_SECRET` | Admin panel auth (Dana's login). |
| `TRANSFER_TOKEN_SALT` | Data transfer tokens. |
| `DATABASE_*` | Connection settings — managed/generated by Strapi Cloud. |

Strapi Cloud manages/generates most of these; **never commit any of them**.

### 3.2 Frontend (Vercel — set for Production **and** Preview)

| Variable | Purpose | Notes |
| :-- | :-- | :-- |
| `STRAPI_URL` | Base URL of the Strapi API, e.g. `https://<your-strapi>.strapiapp.com` | **Server-only. MUST NOT have a `NEXT_PUBLIC_` prefix.** A `NEXT_PUBLIC_` prefix would inline the Strapi origin into the client bundle, exposing the API origin and defeating the server-only fetch model (`03-Technical-Spec.md` §4.2). |
| `SESSION_COOKIE_NAME` | Cookie name holding the JWT, e.g. `gh_token` | Must match the value used by the login, logout, and middleware handlers. |

> **The `NEXT_PUBLIC_` rule is a release-checklist item** (`03-Technical-Spec.md` §10.2: "No `NEXT_PUBLIC_` exposure of `STRAPI_URL` or token"). Keeping `STRAPI_URL` server-only ensures the Strapi origin and JWT never enter the client bundle.

---

## 4. First-deploy ordered checklist
**Maps to:** `03-Technical-Spec.md` §8.

1. **Pin patched versions** (release blocker): Strapi **≥ 5.37.0**, Next.js **≥ 15.2.3** (`03-Technical-Spec.md` §2.1). Add `npm audit` / Dependabot to CI.
2. **Deploy Strapi** to a **paid** Strapi Cloud tier (Essential/Pro — **not** Free, which suspends on overage). Include `src/api`, `src/extensions`, and `config/`. Enable backups.
3. Set the **Strapi env secrets** (§3.1).
4. After build, **create the `client` role and permissions** including Location (§1).
5. **Merge the CORS block** into `config/middlewares.js` (§2); confirm the Vercel slug.
6. **Seed data** (Milestone A): 1 location; 2 properties; 1–2 reports of each type; 2 client users (one single-property, one multi-property). **Publish** the properties and reports (`04-Admin-Runbook.md` §6).
7. **Deploy the frontend** to Vercel from GitHub; set `STRAPI_URL` (server-only) and `SESSION_COOKIE_NAME` for **Production and Preview** (§3.2).
8. Add the custom domain **`client.griswoldhospitality.com`**; confirm cookies are issued `Secure` over HTTPS.
9. **Run the access-control suite** against seeded users — it must pass (§6).
10. **Smoke-test** login, My Properties, and a property detail page; verify the five PRD success metrics (`01-PRD.md` §14).
11. **Hand off** `04-Admin-Runbook.md` to the admin (Milestone E deliverable).

---

## 5. Release & Rollback

### Release
1. Merge to the production branch; **Vercel builds and deploys** the frontend automatically.
2. Confirm Strapi Cloud has the latest schema / controllers / config and the `client` role + permissions (§1).
3. **Run the access-control test suite** against production seed users — **it must pass** (§6).
4. Smoke-test login, My Properties, and a property detail page.
5. Verify the five PRD success metrics (`01-PRD.md` §14).

### Rollback
- **Frontend:** Vercel retains prior deployments — **promote the last good deployment** to roll back instantly.
- **Backend schema:** schema files are version-controlled — **revert and redeploy**. Avoid destructive content-type changes on production data without a backup/export.
- **Access incident:** if a scoping defect is suspected, immediately set affected users to **`blocked = true`** as containment (`04-Admin-Runbook.md` §4) while you fix.

---

## 6. Release-blocker gate
**Maps to:** `03-Technical-Spec.md` §10.2.

A release **must not ship** unless **all** of the following pass:

| # | Gate | Ref |
| :-- | :-- | :-- |
| 1 | User A cannot retrieve User B's property via any query parameter | AC-1 |
| 2 | `findOne` on an unassigned property returns **404** (not 403, no existence leak) | AC-2 |
| 3 | Direct `/api/report-bdtmsds` / `/api/report-ghs` return only the caller's reports | AC-3 |
| 4 | `blocked = true` rejects the user's **next request**, not just login | AC-4 |
| 5 | JWT is **not** readable by client JS (httpOnly cookie only) | AC-5 |
| 6 | Populate cannot leak other accounts (`populate[users]=*`, nested report populate) | AC-23 |
| 7 | No drafts via the API (`?status=draft` returns nothing privileged) | AC-24 |
| 8 | Confidential PDFs not reachable without an ownership check (proxy download) | F10 |
| 9 | Running patched versions: **Strapi ≥ 5.37.0, Next.js ≥ 15.2.3** | §2.1 |

The **access-control suite is a precondition for deploy** and should be re-run on **every** release.
