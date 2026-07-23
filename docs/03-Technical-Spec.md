# Luxury Hotel Audit — Client Portal
## Technical Specification

---

### Document Control

| | |
| :-- | :-- |
| **Document** | Technical Specification |
| **Project** | Luxury Hotel Audit — Client Portal |
| **Client** | Griswold Hospitality |
| **Version** | 2.0 |
| **Status** | For Build |
| **Date** | June 4, 2026 |
| **Target stack** | Strapi 5 (Strapi Cloud) · Next.js 15 (App Router) · Vercel · GitHub · Figma |
| **Related documents** | `01-PRD.md` |
| **Ships with** | `strapi/` — drop-in schema, controllers, routes, and config |

**Version history**

| Version | Date | Summary |
| :-- | :-- | :-- |
| 1.0 | Jun 4, 2026 | Initial technical spec |
| 2.0 | Jun 4, 2026 | Corrected ownership-check status handling and CORS config; added request lifecycle, full reference implementations (reports util, proxy download, error handling, session helpers), rate-limiting, environment matrix, observability, and a file manifest |
| 2.1 | Jun 4, 2026 | Reference-code hardening: scoped the CORS Vercel-preview regex to this project's slug (was any `*.vercel.app`); year filter parses the year from the ISO string instead of `new Date().getFullYear()` (UTC/local off-by-one); proxy download preserves the file's real extension instead of hard-coding `.pdf`. No change to the shipped controllers or the security model. |

> This is the engineering build document. Code targets **Strapi 5** and **Next.js 15 (App Router)**; adapt import style to the project's TS/ESM settings. Requirement IDs (`FR-x`) trace to `01-PRD.md`; acceptance criteria are labeled `AC-x`.

---

### Table of Contents
1. Architecture & Request Lifecycle
2. Prerequisites & Versions
3. Strapi Backend
4. Next.js Frontend
5. API Contracts
6. Data-Shaping Logic
7. Figma → Next.js → Vercel Pipeline
8. Deployment & Environments
9. Observability & Error Handling
10. Testing Strategy & Security Checklist
11. Appendix A — File Manifest
12. Appendix B — Environment Variables

---

## 1. Architecture & Request Lifecycle

### 1.1 Topology

```
                          ┌─────────────────────────────┐
   Client browser ──────► │  Next.js on Vercel           │
   (cookie: gh_token)     │  - RSC pages (server fetch)  │
                          │  - /api/login, /api/logout   │ ── Set-Cookie (httpOnly) ──► browser
                          │  - /api/.../download (proxy) │
                          │  - middleware (route guard)  │
                          └──────────────┬───────────────┘
                                         │  Authorization: Bearer <jwt>
                                         ▼
                          ┌─────────────────────────────┐
                          │  Strapi 5 on Strapi Cloud    │
                          │  - users-permissions (JWT)   │
                          │  - SCOPED controllers (the   │
                          │    real security boundary)   │
                          │  - REST API + media uploads  │
                          └─────────────────────────────┘
```

Two independent applications. The browser never calls Strapi directly for protected data — every Strapi call is made server-side by Next.js (in server components, route handlers, and the proxy download), reading the JWT from the httpOnly cookie. The raw JWT is therefore never present in the client bundle or readable by client-side JavaScript.

### 1.2 Login lifecycle
1. Browser POSTs credentials to the Next.js `/api/login` route handler.
2. The handler POSTs `{ identifier, password }` to Strapi `/api/auth/local`.
3. Strapi validates (including `confirmed`/`blocked`) and returns `{ jwt, user }`.
4. The handler sets `gh_token` as an httpOnly, Secure, SameSite=Lax cookie and returns success.
5. Browser navigates to `/properties`.

### 1.3 Protected page lifecycle
1. Browser requests `/properties` (or `/properties/[id]`).
2. `middleware.ts` checks for the cookie's presence; absent → redirect to `/`.
3. The RSC reads the cookie server-side and calls the **guarded** Strapi endpoint with the Bearer token.
4. Strapi's scoped controller restricts results to the user's properties; unauthorized single-record requests return 404.
5. The RSC renders the scoped data. No token or Strapi origin reaches the client bundle.

---

## 2. Prerequisites & Versions

| Component | Version / Note |
| :-- | :-- |
| Strapi | 5.x (Document Service API, `documentId`) |
| Node.js | As required by the chosen Strapi 5 / Next.js 15 versions (use an active LTS) |
| Next.js | 15.x, App Router; `cookies()` and route `params` are async |
| React | 18+/19 per Next 15 |
| Hosting | Strapi Cloud (backend), Vercel (frontend) |
| Package manager | Team standard (npm/pnpm/yarn) |

### 2.1 Minimum versions & security advisories (mandatory)

Pin to at least these versions; they fix vulnerabilities directly relevant to this design. Add `npm audit` / Dependabot to CI and re-check at deploy time, as both projects ship security fixes frequently.

| Component | Minimum version | Why |
| :-- | :-- | :-- |
| Strapi | **≥ 5.37.0** | Fixes a critical unsanitized relational-filter data-leak (an unauthenticated attacker could extract admin `resetPasswordToken` via crafted nested filters). Also ensures the session/refresh fixes from ≥ 5.24.1 are present. |
| Next.js | **≥ 15.2.3** | Fixes the middleware authorization-bypass via the `x-middleware-subrequest` header (CVE-2025-29927). Vercel's platform also mitigates this, but pin the version regardless. |
| Node.js | Active LTS supported by the above | — |

> Treat all client-controlled query parameters (`filters`, `populate`, `sort`, `status`) as hostile input. The controllers in §3.3 do exactly this.

---

## 3. Strapi Backend

### 3.1 Content model, relations & data dictionary

Shipped as schema files under `strapi/src/`. Relation ownership (owning side carries `inversedBy`; inverse carries `mappedBy`):

| Relation | Owning side | Inverse side | Cardinality |
| :-- | :-- | :-- | :-- |
| Property ↔ User | `Property.users` | `User.properties` | many-to-many |
| Property ↔ Reports BDTMSD | `Property.reports_bdtmsds` | `ReportBdtmsd.properties` | many-to-many |
| Property ↔ Reports GH | `Property.reports_ghs` | `ReportGh.properties` | many-to-many |
| Location ↔ Property | `Property.location` | `Location.properties` | many-to-one / one-to-many |

Field types of note: `performance_score` and `spa_score` are `decimal` (e.g., 87.26); `order` is `integer`; `image` is multiple media (images); report `download` is single media (files). `hotel_performance`/`fb_performance`/`spa_performance`/`property_info` are `text` at the **schema** level, but per the Frontend Redesign convention their **content** is a URL — a Looker Studio embed URL for the three performance fields, a doc link for `property_info` — rendered by the frontend as a guarded iframe / help link, not as prose (§4.11; `01-PRD.md` §7.3). Full field lists are in `01-PRD.md` §7 and the schema files.

**Draft & Publish.** Enabled on all content types so reports/properties can be staged before publishing. The REST API and the core `find`/`findOne` return **published** content by default; the admin must Save & Publish for content to appear on the portal.

> **Strapi 5 identifiers.** Records have a numeric `id` and a stable 24-char `documentId`. The REST API addresses single records by **`documentId`** (`GET /api/properties/:documentId`). The frontend uses `documentId` in URLs.

### 3.2 Installing the schema

Copy `strapi/src/` and `strapi/config/` into the Strapi project and restart. The content types build automatically; the User extension (`src/extensions/users-permissions/content-types/user/schema.json`) adds `full_name` and the `properties` relation to the built-in user. Then create the `client` role and set permissions (§3.4).

> **Verify before deploying:** the shipped `user/schema.json` reproduces the standard users-permissions base schema plus the two added fields. Because the plugin's base schema can change between Strapi minor versions, diff it against the user schema in your installed `@strapi/plugin-users-permissions` and reconcile any differences before relying on it — an out-of-date base could drop a built-in field. Also note `property_type`'s enum values in `property/schema.json` are placeholders; replace them with Griswold's actual property categories.

### 3.3 Security model — the access boundary

Access control is enforced **in Strapi**, not in the browser. The default core `find`/`findOne` would let any authenticated `client` read every property (and, via populate, every other client's reports). The shipped controllers override both actions and apply **two independent protections**:

**(a) Result scoping (filters).** The `find` override force-ANDs `{ users: { id: ctx.state.user.id } }` into the query filters, so no client-supplied filter can widen the result beyond the user's own properties. The `findOne` override verifies the requested `documentId` is owned by the user and returns **404** (not 403) on a miss so we don't leak existence.

**(b) Populate constraint (populate) — added after validation.** Filtering does **not** constrain population, and this is a real, separate leak channel. Without it, a client could request `populate[users]=*` or `populate[reports_ghs][populate][properties][populate][users]=*` and read other clients' usernames, the placeholder emails, and the full property roster — because population is governed by the read permission on the *populated* type, not by your ownership filter. The controllers therefore **ignore any client-supplied `populate`** and set an explicit server-side allow-list that **never traverses to `users`** (and the report controllers never populate `properties`, which would chain to users). Each override also pins `status: 'published'` so a client cannot pull drafts via `?status=draft`.

**Key correctness point.** The core `find`/`findOne` (and REST) return **published** content by default, but the *raw* Document Service `findMany`/`findFirst` default to **draft**. The ownership pre-checks therefore explicitly pass `status: 'published'` so the check matches exactly the data the user will receive.

`property.js` (shipped):

```js
'use strict';
const { factories } = require('@strapi/strapi');
const UID = 'api::property.property';

// Server-defined populate allow-lists. NEVER include `users`.
const LIST_POPULATE = { image: true, location: true, reports_bdtmsds: true, reports_ghs: true };
const DETAIL_POPULATE = {
  image: true, location: true,
  reports_bdtmsds: { populate: { download: true } },
  reports_ghs: { populate: { download: true } },
};

module.exports = factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    await this.validateQuery(ctx);
    const sanitized = await this.sanitizeQuery(ctx);

    // Inject trusted scoping AFTER sanitizing client input so it can't be stripped.
    const query = {
      ...sanitized,
      filters: { $and: [ sanitized.filters ?? {}, { users: { id: user.id } } ] },
      populate: LIST_POPULATE, // ignore client populate
      status: 'published',     // ignore client ?status=draft
    };

    const { results, pagination } = await strapi.service(UID).find(query);
    const sanitizedResults = await this.sanitizeOutput(results, ctx);
    return this.transformResponse(sanitizedResults, { pagination });
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();
    const { id } = ctx.params; // documentId in v5

    // Ownership gate runs with full privileges (not subject to client sanitization).
    const owned = await strapi.documents(UID).findMany({
      filters: { documentId: id, users: { id: user.id } },
      status: 'published', // match what super.findOne() (published) returns
      fields: ['id'],
      limit: 1,
    });
    if (!owned.length) return ctx.notFound(); // 404, not 403 — don't leak existence

    ctx.query = { ...ctx.query, populate: DETAIL_POPULATE, status: 'published' };
    return super.findOne(ctx);
  },
}));
```

**Why `find` is written this way (important).** The trusted ownership filter is injected **after** `sanitizeQuery`, then passed straight to the service — not merged into `ctx.query` before `super.find`. This matters because query sanitization can strip filters that reference relations the role lacks field access to; if the `{users:{id}}` filter were stripped, `find` would fail *open* and return every property. Injecting post-sanitization makes that impossible. Output still goes through `sanitizeOutput`, so private fields never leak. `findOne` is safe via a different mechanism: the ownership gate runs with full privileges (immune to client sanitization) before any data is returned, and the populate is overwritten before delegating to core. The `report-bdtmsd.js`, `report-gh.js`, and `location.js` controllers apply the same two patterns, scoped by `properties.users.id`, and never populate `properties`/relations that chain to users. `ctx.state.user` is set by the users-permissions plugin from the verified JWT and cannot be spoofed.

> **Rules.** (1) Do not relax these overrides. (2) Never add `users` to a populate allow-list. (3) Always inject the ownership filter *after* sanitization in `find`. (4) The access-control and populate-leak tests (§10.2: AC-1–AC-4, AC-23, AC-24) are release blockers.

### 3.4 Roles & permissions

Create a single role, **`client`** (Settings → Users & Permissions → Roles). Grant **only**:

| Content type | Permissions | Notes |
| :-- | :-- | :-- |
| Property | `find`, `findOne` | Scoped by `property.js` |
| Reports BDTMSD | `find`, `findOne` | Scoped by `report-bdtmsd.js` |
| Reports GH | `find`, `findOne` | Scoped by `report-gh.js` |
| Location | `find`, `findOne` | **Required** so `location.name` can populate on a property (Strapi gates population by the populated type's read permission). Scoped by `location.js` to only the user's locations, so this grant does not expose the full location list. |

Leave the auth endpoints (`auth.local`, etc.) on the **Public** role as they are by default. Do **not** grant `create`/`update`/`delete` anywhere, and do not grant access to the Users-Permissions user endpoints. Leave the Public role with no access to Property/Reports/Location.

### 3.5 JWT & sessions

`strapi/config/plugins.js` sets the client session length:

```js
module.exports = ({ env }) => ({
  'users-permissions': {
    config: {
      jwt: { expiresIn: '7d' }, // product decision (DD-9); see hardening note below
    },
  },
});
```

Set a strong `JWT_SECRET` env var in Strapi Cloud (never commit).

**How revocation actually works (validated).** Strapi's users-permissions request authenticator does a live database lookup of the user on **every** authenticated request and rejects the request if `user.blocked` is true. So setting `blocked = true` is a genuine, immediate kill switch: an already-issued JWT stops working on the user's very next request, without waiting for expiry (FR-2.5, AC-4). Note: the parallel `confirmed` check is only enforced per-request when the plugin's `email_confirmation` advanced setting is enabled; otherwise `confirmed` is enforced only at login. For a confidential portal, enabling `email_confirmation` makes `confirmed` a per-request gate too — but then admin-created accounts must be explicitly confirmed (they are, per the admin workflow) or their logins will 401.

**The real residual risk** is a *leaked/stolen* token: plain logout clears the cookie in the browser but does not invalidate the JWT server-side, so a copied token remains valid until it expires. Strapi's default expiry is **30 days**; the shipped config shortens this to 7 days.

**Hardening recommendation (strongly advised for confidential data).** OWASP guidance puts access-token lifetimes in the minutes range for sensitive resources; a 7-day stateless token is far longer. Consider one of:
- Reduce `expiresIn` to `1d` (or shorter) and add a server-side sliding refresh in the Next.js data layer; or
- Adopt the refresh-token / session mechanism available in current Strapi (≥ 5.24.1) for proper logout-time invalidation.

If the 7-day session is kept as a product decision, treat it as a **documented accepted risk** and rely on the per-request `blocked` check, short-as-tolerable expiry, audit logging, and login rate limiting as compensating controls. (See PRD DD-9 and Risk R10.)

### 3.6 CORS

Strapi's `origin` performs exact string matching — a literal `'https://*.vercel.app'` will **not** match preview URLs. Use a function to allow the production domain, localhost, and Vercel previews. Note: Strapi's CORS uses `@koa/cors`, whose `origin` resolver must return a **string** (the origin to allow), not a boolean — so for disallowed origins we return the production origin as a safe, non-reflecting default (the browser then blocks the mismatched cross-origin request). In `strapi/config/middlewares.js`:

```js
const PROD_ORIGIN = 'https://client.griswoldhospitality.com';
// Vercel project slug for this portal's frontend. Preview URLs look like
// `<slug>-<hash>-<team>.vercel.app` or `<slug>-git-<branch>-<team>.vercel.app`.
// Scoping the regex to this slug means we allow ONLY this project's previews,
// not every tenant on *.vercel.app. Confirm the exact slug in Vercel first.
const VERCEL_PROJECT = 'griswold-portal';
const VERCEL_PREVIEW_RE = new RegExp(`^https://${VERCEL_PROJECT}-[a-z0-9-]+\\.vercel\\.app$`);

module.exports = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: (ctx) => {
        const allowed = [PROD_ORIGIN, 'http://localhost:3000'];
        const reqOrigin = ctx.request.header.origin;
        if (reqOrigin && allowed.includes(reqOrigin)) return reqOrigin;
        // Allow Vercel preview deployments for THIS project only (a bare
        // `*.vercel.app` pattern would trust any Vercel customer's app):
        if (reqOrigin && VERCEL_PREVIEW_RE.test(reqOrigin)) return reqOrigin;
        // Disallowed: return a safe default (never reflect an untrusted origin).
        return PROD_ORIGIN;
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
```

Because protected data is fetched server-side from Next.js (not the browser), CORS is **defense-in-depth here, not the security boundary** — the browser never calls Strapi directly. Keep the allow-list tight regardless, verify the exact `@koa/cors` return-value behavior against your installed version, and tighten/remove the preview pattern before launch if not needed.

### 3.7 Login rate limiting / brute-force

Strapi's users-permissions plugin applies a rate-limit policy to the auth routes. This project pins it explicitly in `config/plugins.{ts,js}` to **10 requests / 60s per IP** on `/api/auth/local` in production (disabled outside production so the access-control suite's rapid logins don't hit a 429). There is no account lockout (by design — admin-managed). This blunts naive brute force but is per-IP (defeated by rotating IPs) and does nothing against credential-stuffing across many accounts. Because shared accounts magnify the blast radius of a single guessed password, harden as follows:
- Lower the auth rate limit further and/or add an application-level limiter on the Next.js login route handler (e.g., Upstash/Vercel KV keyed by IP + username).
- Add a Vercel WAF rate rule on the login path.
- Require strong, admin-set passwords (ideally screened against known-breach lists) and rotate shared passwords when property staff change.

Do not implement client-side lockout; it provides no real protection.

### 3.8 Media security (decision — Milestone E / F10)

Strapi serves uploaded files (report PDFs in `download`) from public, unguessable URLs. The URLs are hard to guess but are **not access-controlled** — anyone with the link can fetch the file. For confidential audit reports, choose one:

1. **Authenticated proxy download (recommended).** The PDF is fetched server-side by a Next.js route that re-checks ownership against Strapi, then streams the file. The public media URL is never exposed to the client. Implementation in §4.10. No third-party provider required; matches the existing security model.
2. **Signed / expiring URLs.** Configure an upload provider (e.g., S3) that issues short-lived signed URLs generated per request after an ownership check.

The same concern applies in spirit to `full_report`: it points at an externally hosted interactive report whose access control is outside this system. Confirm the upstream host gates it, or treat the link as semi-public and document the assumption (PRD §12 A3, Risk R3).

### 3.9 Backend environment variables
See Appendix B. Strapi Cloud manages most secrets; never commit them.

---

## 4. Next.js Frontend

### 4.1 Project structure

```
app/
  layout.tsx
  page.tsx                          → Login (route "/")
  properties/
    page.tsx                        → My Properties (RSC, scoped fetch)
    [id]/
      page.tsx                      → Property detail (RSC, scoped fetch)
      not-found.tsx
  api/
    login/route.ts                  → POST: auth + set httpOnly cookie
    logout/route.ts                 → POST: clear cookie
    properties/[id]/reports/[reportId]/download/route.ts  → proxy download (F10)
components/
  LoginForm.tsx                     → client component
  PropertyCard.tsx
  PropertyGrid.tsx
  TabBar.tsx
  ReportsTab.tsx                    → list + year filter + name search (client)
  PerformanceTab.tsx
  EmptyState.tsx
lib/
  strapi.ts                         → server-side fetch helper
  session.ts                        → cookie read/clear helpers
  reports.ts                        → merge + latest-report logic
  types.ts                          → shared TS types
middleware.ts                       → route guard
```

### 4.2 Environment variables

```
STRAPI_URL=https://<your-strapi>.strapiapp.com   # server-only; NO NEXT_PUBLIC_ prefix
SESSION_COOKIE_NAME=gh_token
```

Keep `STRAPI_URL` server-only so the Strapi origin and token never enter the client bundle. (See Appendix B.)

### 4.3 Auth — login route handler

```ts
// app/api/login/route.ts
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  let identifier: string, password: string;
  try {
    ({ identifier, password } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!identifier || !password) {
    return Response.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const res = await fetch(`${process.env.STRAPI_URL}/api/auth/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
    cache: 'no-store',
  });

  if (!res.ok) {
    // Strapi returns 400 for bad creds / blocked / unconfirmed. Keep the
    // client message generic — don't reveal which accounts exist.
    return Response.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  const { jwt } = await res.json();
  (await cookies()).set(process.env.SESSION_COOKIE_NAME!, jwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // MUST match the Strapi JWT expiresIn (§3.5); change both together
  });

  return Response.json({ ok: true });
}
```

`identifier` accepts username *or* email natively (FR-1.1, AC-6/AC-7). Blocked/unconfirmed accounts are rejected by Strapi at this step (FR-1.5, AC-9).

### 4.4 Auth — logout

```ts
// app/api/logout/route.ts
import { cookies } from 'next/headers';

export async function POST() {
  (await cookies()).delete(process.env.SESSION_COOKIE_NAME!);
  return Response.json({ ok: true });
}
```

### 4.5 Route guard (middleware)

```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

const COOKIE = process.env.SESSION_COOKIE_NAME ?? 'gh_token';

export function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (req.nextUrl.pathname.startsWith('/properties') && !token) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/properties/:path*'] };
```

Middleware checks cookie presence only (cheap). True authorization happens server-side on every Strapi call, so a stale or forged cookie still yields no data.

> **Middleware is a UX redirect, not a security boundary.** CVE-2025-29927 allowed bypassing Next.js middleware entirely via a crafted `x-middleware-subrequest` header (patched in Next.js ≥ 15.2.3 — see §2.1; Vercel's platform also mitigates it). The security boundary is the guarded Strapi endpoints plus the server-side fetch layer (§4.6), which re-verify on every request. Never put the *only* authorization check in middleware.

### 4.6 Session helpers & Strapi fetch helper

```ts
// lib/session.ts
import { cookies } from 'next/headers';

export async function getToken(): Promise<string | undefined> {
  return (await cookies()).get(process.env.SESSION_COOKIE_NAME!)?.value;
}
```

```ts
// lib/strapi.ts
import { getToken } from './session';

export async function strapiFetch(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${process.env.STRAPI_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store', // always reflect latest Strapi content; no redeploy (FR-5.5)
  });
  return res;
}
```

`cache: 'no-store'` is what makes published content appear without a deploy (AC-21).

### 4.7 My Properties page

Reads the **guarded** `/api/properties` (not `users/me` — see PRD §16, DD-15). Strapi returns only this user's properties (FR-3.1, AC-1). The controller defines the populate allow-list server-side, so the frontend does **not** send `populate` (any it sent would be ignored); it only requests sort order.

```ts
// app/properties/page.tsx  (React Server Component)
import { strapiFetch } from '@/lib/strapi';
import { latestReportSummary } from '@/lib/reports';
import PropertyGrid from '@/components/PropertyGrid';
import EmptyState from '@/components/EmptyState';

export default async function MyProperties() {
  // Populate is enforced by the property controller (LIST_POPULATE); we only sort.
  const res = await strapiFetch(`/api/properties?sort=order:asc`);
  if (!res.ok) throw new Error('Failed to load properties');

  const { data } = await res.json();
  if (!data?.length) return <EmptyState message="No properties are assigned to your account yet." />;

  const cards = data.map((p: any) => {
    const { latestScore, latestDate } = latestReportSummary(p.reports_bdtmsds, p.reports_ghs);
    return {
      id: p.documentId,
      name: p.name,
      location: p.location?.name ?? null,
      image: p.image?.[0]?.url ?? null,
      latestScore,
      latestDate,
      order: p.order ?? 0,
    };
  });

  return <PropertyGrid cards={cards} />;
}
```

The first card (lowest `order`) gets the featured/larger treatment inside `PropertyGrid` (FR-3.4).

### 4.8 Property detail page

```ts
// app/properties/[id]/page.tsx
import { notFound } from 'next/navigation';
import { strapiFetch } from '@/lib/strapi';
import TabBar from '@/components/TabBar';

export default async function PropertyDetail(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Populate (incl. report download files) is enforced by the controller (DETAIL_POPULATE).
  const res = await strapiFetch(`/api/properties/${id}`);

  if (res.status === 404) notFound();                 // server enforced the guard (AC-18)
  if (!res.ok) throw new Error('Failed to load property');

  const { data: property } = await res.json();
  return <TabBar property={property} />;
}
```

Because the guarded `findOne` returns 404 for an unassigned property, URL-guessing is handled server-side; the page just calls `notFound()` (FR-4.9, AC-18). `not-found.tsx` renders a friendly message with a link back to My Properties.

### 4.9 Reports tab — merge & filtering (client component)

The tab receives the already-scoped report arrays and filters in the browser (no extra API calls). Shared types:

```ts
// lib/types.ts
export type ReportRow = {
  id: string;
  source: 'BDTMSD' | 'GH';
  type: string | null;
  date: string | null;             // ISO date
  performanceScore: number | null;
  spaScore: number | null;         // GH only
  downloadHref: string | null;     // proxy route, not the raw Strapi URL
  fullReport: string | null;
};
```

```ts
// lib/reports.ts (merge helper used by the Reports tab)
import type { ReportRow } from './types';

export function toRows(propertyId: string, bdtmsd: any[] = [], gh: any[] = []): ReportRow[] {
  const map = (r: any, source: 'BDTMSD' | 'GH'): ReportRow => ({
    id: r.documentId,
    source,
    type: r.type ?? null,
    date: r.date ?? null,
    performanceScore: r.performance_score ?? null,
    spaScore: source === 'GH' ? (r.spa_score ?? null) : null,
    downloadHref: r.download
      ? `/api/properties/${propertyId}/reports/${r.documentId}/download`
      : null,
    fullReport: r.full_report ?? null,
  });
  return [
    ...bdtmsd.map((r) => map(r, 'BDTMSD')),
    ...gh.map((r) => map(r, 'GH')),
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')); // newest first
}

export function distinctYears(rows: ReportRow[]): number[] {
  const years = new Set<number>();
  // Parse the year straight from the ISO date string. Using
  // `new Date(r.date).getFullYear()` would read a UTC-midnight date in local
  // time, shifting Jan-1 reports into the previous year for UTC-negative zones.
  rows.forEach((r) => { if (r.date) years.add(Number(r.date.slice(0, 4))); });
  return [...years].sort((a, b) => b - a);
}
```

Behavior (FR-4.6, AC-16): a year `<select>` ("All" + each year from `distinctYears`) filters by the report's year parsed from the ISO date string (`Number(date.slice(0, 4))`, not `new Date(date).getFullYear()` — see the note in `distinctYears`); a search box does a case-insensitive substring match on `type`. **View Report** is an anchor to `fullReport` with `target="_blank" rel="noopener noreferrer"` (FR-4.4). **Download** points at `downloadHref` (the proxy route, §4.10), never the raw Strapi URL. GH rows display `spaScore`; BDTMSD rows do not (AC-14).

### 4.10 Proxy download route (F10, recommended media strategy)

Re-checks ownership server-side, then streams the file. The raw Strapi media URL is never exposed.

```ts
// app/api/properties/[id]/reports/[reportId]/download/route.ts
import { strapiFetch } from '@/lib/strapi';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const { id, reportId } = await params;

  // 1) Confirm the property is assigned to this user (guarded findOne → 404 if not).
  //    The controller's DETAIL_POPULATE already includes the report download files.
  const propRes = await strapiFetch(`/api/properties/${id}`);
  if (propRes.status === 404) return new Response('Not found', { status: 404 });
  if (!propRes.ok) return new Response('Error', { status: 500 });

  const { data: property } = await propRes.json();

  // 2) Find the report among this property's reports and read its file URL.
  const all = [
    ...(property.reports_bdtmsds ?? []),
    ...(property.reports_ghs ?? []),
  ];
  const report = all.find((r: any) => r.documentId === reportId);
  const fileUrl: string | undefined = report?.download?.url;
  if (!fileUrl) return new Response('Not found', { status: 404 });

  // Stream the file back. Sanitize the filename: strip quotes/control chars so a
  // report `type` containing a quote can't break or inject the header.
  const safeName = (report.type ?? 'report').replace(/[^\w.\- ]+/g, '_').slice(0, 100);
  // Preserve the real extension. `download` allows files OR images, so don't
  // hard-code `.pdf` — derive it from the upstream URL (path only, no query).
  const ext = fileUrl.split('?')[0].match(/\.[a-z0-9]+$/i)?.[0] ?? '.pdf';
  const absolute = fileUrl.startsWith('http') ? fileUrl : `${process.env.STRAPI_URL}${fileUrl}`;
  const fileRes = await fetch(absolute, { cache: 'no-store' });
  if (!fileRes.ok || !fileRes.body) return new Response('Not found', { status: 404 });

  return new Response(fileRes.body, {
    status: 200,
    headers: {
      'Content-Type': fileRes.headers.get('Content-Type') ?? 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}${ext}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
```

Because step 1 reuses the guarded `findOne`, ownership is enforced by the same boundary as everything else; a client cannot download another client's PDF even with the report id.

### 4.11 Performance tabs (redesigned — supersedes DD-10)

`hotel_performance`, `fb_performance`, `spa_performance` are `text` fields whose **content convention** is a Looker Studio embed URL (set by the editor, per `04-Admin-Runbook.md`). The frontend does **not** render them as prose:

- `lib/embed.ts` exports `lookerEmbedSrc(value)`, which returns the URL only if it parses as `https://lookerstudio.google.com/...`; any other value (plain text, another origin, `javascript:`/`data:`) returns `null`.
- `PerformanceTab` embeds the guarded value as a full-width `<iframe>` (~800px tall). A tab whose field is empty or fails the guard is hidden (empty performance tabs are not shown) or falls back to a safe link — never to raw/unsanitized text.
- `property_info` uses the sibling `safeHttpUrl(value)` guard (http/https only) and renders as a "?" help link on the detail page, not as a description.
- **CSP:** `next.config.mjs` sets `frame-src https://lookerstudio.google.com https://datastudio.google.com https://accounts.google.com` — the Looker Studio embed family: `lookerstudio.google.com` is the embed host, and the other two permit Looker's *own* in-iframe redirects (the legacy `datastudio` domain, and `accounts.google.com` for viewer auth). `img-src` is `'self' https: data: blob:` — intentionally broad, since property images may be served from any https media host. The real defense against a malicious embed is the **code-level** host guard `lib/embed.ts` → `lookerEmbedSrc`, which emits an iframe only for a `lookerstudio.google.com` URL; the CSP `frame-src` is defense-in-depth, not the primary control. Other directives (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, HSTS, etc.) are unchanged. See `09-Frontend-Design-System.md` for the full design-system reference.

A value that isn't a conforming URL must degrade gracefully (no embed/no link) — it must never be rendered as raw HTML/text. The iframe safety guarantee is enforced in code (`lib/embed.ts` accepts only a `lookerstudio.google.com` URL), so do not rely on the CSP `img-src` being host-scoped — it deliberately allows any https origin for images; the `frame-src` allow-list is the Looker family listed above.

### 4.12 Error, empty & loading states
- **Loading:** use route-level `loading.tsx` (or Suspense) for the RSC fetches.
- **Empty:** `EmptyState` for clients with no properties (FR-3.7) and for properties with no reports.
- **Not found:** `properties/[id]/not-found.tsx` for the guard case (AC-18).
- **Error:** an `error.tsx` boundary for failed fetches; show a generic message, never raw error detail or Strapi internals.
- **Auth expiry:** if a server fetch returns 401/403 (expired/invalid token), redirect to `/` so the user re-authenticates.

---

## 5. API Contracts

All protected calls carry the JWT in `Authorization: Bearer`, attached server-side by `strapiFetch`.

| Call | Method | Auth | Returns |
| :-- | :-- | :-- | :-- |
| `/api/auth/local` | POST | none | `{ jwt, user }` on success; 400 on bad/blocked/unconfirmed |
| `/api/properties?...&sort=order:asc` | GET | Bearer | **scoped** array of the user's properties |
| `/api/properties/:documentId?...` | GET | Bearer | the property if owned, else **404** |
| `/api/report-bdtmsds`, `/api/report-ghs` | GET | Bearer | scoped to the user's properties (defense-in-depth) |

**Request body — login**
```json
{ "identifier": "fourseasonsmaui", "password": "•••••••" }
```
`identifier` may be a username or an email.

**Response shape — properties (Strapi 5)**
```json
{
  "data": [
    {
      "id": 12,
      "documentId": "abcd1234efgh5678ijkl9012",
      "name": "Four Seasons Hualalai",
      "order": 0,
      "location": { "name": "Kailua-Kona, Hawaii" },
      "image": [{ "url": "https://.../hero.jpg" }],
      "reports_bdtmsds": [{ "documentId": "...", "type": "Q4 2025 Luxury Audit", "performance_score": 87.26, "date": "2025-12-01", "full_report": "https://...", "download": { "url": "https://.../report.pdf" } }],
      "reports_ghs": [{ "documentId": "...", "performance_score": 90.1, "spa_score": 88.0, "date": "2025-11-15", "full_report": "https://...", "download": { "url": "https://.../gh.pdf" } }]
    }
  ],
  "meta": { "pagination": { "page": 1, "pageSize": 25, "pageCount": 1, "total": 1 } }
}
```
(Exact populate shape depends on the populate query; adjust as needed.)

---

## 6. Data-Shaping Logic

### 6.1 Latest report summary (My Properties cards, FR-3.5)

```ts
// lib/reports.ts (continued)
type AnyReport = { performance_score?: number; date?: string };

export function latestReportSummary(bdtmsd: AnyReport[] = [], gh: AnyReport[] = []) {
  const all = [...bdtmsd, ...gh].filter((r) => r?.date);
  if (!all.length) return { latestScore: null as number | null, latestDate: null as string | null };
  const latest = all.reduce((a, b) =>
    (new Date(a.date!).getTime() >= new Date(b.date!).getTime() ? a : b)
  );
  return { latestScore: latest.performance_score ?? null, latestDate: latest.date ?? null };
}
```

The card always shows the **overall** `performance_score` of the newest report by `date`, across both report types (DD per PRD §8.2 resolution).

> **Efficiency note.** The simple approach above populates *all* reports per property just to pick the latest. For the expected data volume (a boutique set of properties, modest reports each) this is fine. If report counts grow, optimize by either (a) populating reports with `sort: ['date:desc']`, `limit: 1`, and only the needed `fields` in the controller's `LIST_POPULATE`, or (b) denormalizing `latest_score` / `latest_report_date` onto Property via a lifecycle hook updated when a report is published. Add an index on `Reports.date` if query plans show scans.

---

## 7. Figma → Next.js → Vercel Pipeline

**Goal:** Figma is the design source of truth, and design changes flow into the Next.js codebase. **Set expectations honestly: there is no fully automatic "edit in Figma → deployed code" button.** The realistic 2026 workflow is agent-assisted regeneration of a mapped component library, committed to Git, auto-deployed by Vercel.

**Recommended setup**
1. **Design tokens first.** Define colors, type scale, spacing, and radii as Figma variables; mirror them as CSS variables / a Tailwind theme so a token change maps to one place in code.
2. **A component library, not one-off screens.** Build the portal UI as reusable components (Button, Card, TabBar, Field, etc.) in both Figma and React; pages are compositions.
3. **Figma Dev Mode MCP server.** Exposes a selected component's structure, styles, and tokens to an AI coding agent (Cursor, Copilot, Claude Code, etc.) in the IDE, which generates/updates the matching React component. A remote MCP endpoint is available (no desktop app required).
4. **Code Connect.** Maps each Figma component to its React implementation (`.figma.ts` template files, via CLI or the in-Figma UI connected to the GitHub repo), so regenerations target the right files and respect existing props. **Requires a Figma Dev/Full seat on an Org or Enterprise plan — confirm the client's plan (PRD §12 D3).**
5. **Git + Vercel.** Generated/updated components are committed; Vercel auto-deploys every push to the production branch and gives per-PR preview URLs.

**Practical loop:** designer updates a Figma component → developer selects it in Dev Mode → prompts the agent (via MCP + Code Connect) to update the React component → reviews the diff in a PR → merge → Vercel deploys. Content and users continue to come from Strapi at runtime, untouched by this loop.

> Bidirectional Figma↔code sync (pushing rendered UI back to Figma as editable frames) is emerging in some agent integrations, but for v1 keep a human in the review loop.

---

## 8. Deployment & Environments

### 8.1 Environment matrix

| Environment | Frontend | Backend | Purpose |
| :-- | :-- | :-- | :-- |
| Local | `localhost:3000` | Local Strapi or shared dev Strapi Cloud | Development |
| Preview | Vercel per-PR URL (`*.vercel.app`) | Dev/staging Strapi Cloud | Review per pull request |
| Production | `client.griswoldhospitality.com` | Production Strapi Cloud | Live portal |

Keep production and non-production Strapi data separate. The CORS allow-list (§3.6) reflects these origins.

### 8.2 Strapi (Strapi Cloud)
- **Use a paid tier (Essential/Pro), not Free.** The Free plan caps API requests, DB entries, storage, and bandwidth and **suspends the project on overage until the next month** — unsuitable for a production client-facing portal. Enable backups.
- Custom controllers, routes, policies, middlewares, and custom upload providers are all just application code and run on Strapi Cloud identically to self-hosted — the scoping controllers and any S3 provider are fully supported.
- Deploy the project including `src/api`, `src/extensions`, and `config/`.
- Set secrets as env vars: `JWT_SECRET`, `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT` (Strapi Cloud manages/generates these — never commit).
- After first deploy: create the `client` role and set permissions including Location (§3.4); configure CORS (§3.6).
- Confirm Draft & Publish behaves (published content only on the API). When publishing, publish a Property together with its linked Reports and the User⇄Property relation, or a client may see a partial/empty report list.

### 8.3 Frontend (Vercel)
- Connect the GitHub repo; the production branch auto-deploys.
- Set `STRAPI_URL` and `SESSION_COOKIE_NAME` for Production **and** Preview.
- Add the custom domain `client.griswoldhospitality.com`.
- Cookies are issued `Secure` over HTTPS in production.

Content goes live without redeploys — `strapiFetch` uses `cache: 'no-store'` (AC-21).

---

## 9. Observability & Error Handling

- **Logging:** rely on Vercel (frontend/function logs) and Strapi Cloud (API logs). Do not log tokens, passwords, or full request bodies for auth.
- **Auth vs authorization:** a 401 from Strapi means authentication failed (bad/missing token); a 403 means authenticated but not permitted; the scoped `findOne` returns 404 for not-owned records by design (don't convert these to 403). Surface generic messages to clients.
- **Frontend boundaries:** `error.tsx` and `not-found.tsx` per route segment; never expose Strapi origins, stack traces, or internal IDs to the client.
- **Token expiry:** treat a 401/403 on a server fetch as session expiry → redirect to login.

---

## 10. Testing Strategy & Security Checklist

### 10.1 Strategy
- **Access-control suite (highest priority):** scripted API tests with two seeded users covering AC-1–AC-4; must pass before every deploy.
- **Auth/session:** integration tests for login (username and email), failure, logout, route protection.
- **Component tests:** card rendering, latest-report summary, report merge, filters.
- **Accessibility:** automated (axe) + keyboard pass (NFR-5).
- **Cross-browser/responsive:** manual matrix (NFR-6).

### 10.2 Security checklist (release blockers marked ★)
- [ ] ★ User A cannot retrieve User B's property via any query parameter (AC-1).
- [ ] ★ `findOne` on an unassigned property → 404 (AC-2).
- [ ] ★ Direct `/api/report-bdtmsds` / `/api/report-ghs` return only the caller's reports (AC-3).
- [ ] ★ `blocked = true` rejects the user's next request, not just login (AC-4).
- [ ] ★ JWT not readable by client JS; present only as an httpOnly cookie (AC-5). *Verified by code review (login route sets `httpOnly`+`secure`; no `NEXT_PUBLIC_` token) + a manual DevTools check — not by the scripted API suite, which cannot observe browser JS access (see tests/access-control/README.md).*
- [ ] ★ **Populate cannot leak other accounts:** `populate[users]=*` on properties, and `populate[properties][populate][users]=*` on reports, return **no** user data (no usernames/emails/roster). (AC-23)
- [ ] ★ **No drafts via the API:** requesting `?status=draft` returns no unpublished/privileged data (AC-24).
- [ ] ★ Confidential PDFs not reachable without an ownership check (F10, §3.8/§4.10).
- [ ] ★ Running patched versions: Strapi ≥ 5.37.0, Next.js ≥ 15.2.3 (§2.1).
- [ ] Ownership checks pinned to published status (§3.3).
- [ ] CORS allow-list correct; function-based origin; never `*` with credentials; anchored Vercel-preview regex (§3.6).
- [ ] Auth route rate limiting active (10 requests / 60s per IP in production) plus any added app-level limiter (§3.7).
- [ ] `client` role least-privilege: `find`/`findOne` on Property, Reports (both), Location only; no write perms; no user-endpoint access (§3.4).
- [ ] No `NEXT_PUBLIC_` exposure of `STRAPI_URL` or token.
- [ ] Generic client-facing error messages; no internal detail leaked (§9).
- [ ] JWT lifetime reviewed against §3.5 (≤ 1d recommended, or 7d accepted as documented risk).

### 10.3 Functional checklist
- [ ] Login by username and by email; bad creds → error, no recovery link (AC-6–AC-8).
- [ ] Logged-out access to protected routes → redirect; logout clears session (AC-10).
- [ ] My Properties: correct set, `order`, latest score/date, featured card, empty state (AC-11–AC-13).
- [ ] Detail: four tabs render correct fields; both report types; GH spa score shown; View Report new tab; Download via proxy (AC-14–AC-17).
- [ ] Year filter + name search behave; "All" resets (AC-16).
- [ ] Admin: user+property in under 60s; password reset = set new + Save; new report appears with no redeploy; no email integration (AC-19–AC-22).

---

## 11. Appendix A — File Manifest (shipped `strapi/`)

```
strapi/
├── config/
│   └── plugins.js                                              JWT expiry = 7d
└── src/
    ├── api/
    │   ├── property/
    │   │   ├── content-types/property/schema.json
    │   │   ├── controllers/property.js                          ★ scoped (security)
    │   │   └── routes/property.js
    │   ├── report-bdtmsd/
    │   │   ├── content-types/report-bdtmsd/schema.json
    │   │   ├── controllers/report-bdtmsd.js                     ★ scoped (security)
    │   │   └── routes/report-bdtmsd.js
    │   ├── report-gh/
    │   │   ├── content-types/report-gh/schema.json
    │   │   ├── controllers/report-gh.js                         ★ scoped (security)
    │   │   └── routes/report-gh.js
    │   └── location/
    │       ├── content-types/location/schema.json
    │       ├── controllers/location.js                          ★ scoped (security)
    │       └── routes/location.js
    └── extensions/
        └── users-permissions/content-types/user/schema.json    adds full_name + properties
```

> Not shipped (configure in the live project): `config/middlewares.js` CORS edit (§3.6), the `client` role/permissions (§3.4), and the Next.js frontend (§4). The CORS block above is provided as a copy-in reference.

---

## 12. Appendix B — Environment Variables

**Strapi (Strapi Cloud — set as secrets, never commit)**

| Variable | Purpose |
| :-- | :-- |
| `JWT_SECRET` | Signs users-permissions JWTs |
| `APP_KEYS` | Session/signing keys |
| `API_TOKEN_SALT` | API token hashing |
| `ADMIN_JWT_SECRET` | Admin panel auth |
| `TRANSFER_TOKEN_SALT` | Data transfer tokens |
| `ENCRYPTION_KEY` | Encrypts values at rest (e.g. provider configs). **Required by the boot guard** (`strapi/src/index.js` `register()`) — the app refuses to start in production if this is unset or still a placeholder. Generate with `openssl rand -base64 32`, same as the other secrets above. |
| `DATABASE_*` | Managed by Strapi Cloud |

**Frontend (Vercel — Production + Preview)**

| Variable | Purpose | Notes |
| :-- | :-- | :-- |
| `STRAPI_URL` | Base URL of the Strapi API | **Server-only**; no `NEXT_PUBLIC_` prefix |
| `SESSION_COOKIE_NAME` | Cookie name for the JWT (e.g., `gh_token`) | Must match login/logout/middleware |
