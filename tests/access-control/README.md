# Access-Control Test Suite — Griswold Hospitality Client Portal

Runnable, **dependency-free** API tests for the Strapi 5 backend's access-control
boundary. Covers the release-blocker acceptance criteria and the security checklist
in `03-Technical-Spec.md` §10.2. These tests exercise the **shipped scoped controllers** (`property.js`,
`report-bdtmsd.js`, `report-gh.js`, `location.js`) over the real REST API.

They use only Node 18+ built-ins: the `node:test` runner and global `fetch`.
No `npm install` is needed.

> **A passing access-control suite is a precondition for deploy.** Re-run it
> against the production seed users on every release.

---

## What is automated vs. manual

| AC | What it checks | Status |
| :-- | :-- | :-- |
| **AC-1** | `GET /api/properties` returns only the caller's properties; crafted `filters`, `$or`, `pagination[pageSize]=1000`, `sort`, `fields` cannot widen the set; User A and User B see disjoint own-only sets. | **Automated** (`ac-01-properties-scoping.test.mjs`) |
| **AC-2** | `GET /api/properties/{UNOWNED_PROPERTY_ID}` returns **404** with no body data and no existence leak (not 403). | **Automated** (`ac-02-findone-404.test.mjs`) |
| **AC-3** | `GET /api/report-bdtmsds` and `/api/report-ghs` return only reports tied to the caller's assigned properties; crafted filters can't widen; no `properties`/`users` populated. | **Automated** (`ac-03-reports-scoping.test.mjs`) |
| **AC-23** | `populate[users]=*`, `populate=*`, and nested `reports->properties->users` chains return **no** `users`/`email`/`username` fields and no email-like strings, on both collections and the owned-detail view. | **Automated** (`ac-23-populate-leak.test.mjs`) |
| **AC-24** | `?status=draft` and `?publicationState=preview` return nothing the default published view doesn't already contain; and (if `DRAFT_PROPERTY_ID` is set) a known unpublished property owned by User A never appears in any view. | **Automated** (`ac-24-drafts.test.mjs`) |
| **AC-4** | `blocked = true` rejects the existing JWT on the next request **and** blocks re-login. | **Manual / optional** (`ac-04-blocked-killswitch.test.mjs`, skipped unless `RUN_AC4=1`). Requires an admin to toggle `blocked` mid-test — the suite cannot toggle it (the `client` role has no user-management permission, by design). |
| **AC-5** | JWT is not readable by client-side JavaScript (httpOnly cookie only). | **Not API-testable — verified at the frontend layer.** See note below. |

### AC-5 note (why there is no test here)

AC-5 is a **frontend/browser** property, not an API behavior. The JWT is set by
the Next.js `/api/login` route as an `httpOnly`, `Secure`, `SameSite=Lax`
cookie (`gh_token`), and the browser never calls Strapi directly for protected
data (`03-Technical-Spec.md` §1.1–§1.3, §4.3). "Not readable by client-side JS"
can only be observed in the browser (e.g. asserting `document.cookie` does not
contain the token, and that the token never appears in the client bundle).
There is no API request that can prove or disprove it, so **no test is written
here** — it is covered by the frontend test layer and a manual DevTools check.

---

## Required seed data

Provision these in Strapi before running. All Property/Report records must be
**Published** (Draft & Publish
is enabled; the API only returns published content).

1. **One `client` role** with least-privilege `find`/`findOne` on Property, both
   report types, and Location (`03-Technical-Spec.md` §3.4). No write perms; no
   user-endpoint access.
2. **User A** — a `client` user, `confirmed = true`, `blocked = false`, assigned
   **one or more** properties (e.g. P1, P2). Set `USER_A_IDENTIFIER` /
   `USER_A_PASSWORD`.
3. **User B** — a `client` user, `confirmed = true`, `blocked = false`, assigned
   a **disjoint** set of properties (none shared with User A). Set
   `USER_B_IDENTIFIER` / `USER_B_PASSWORD`.
4. **At least one property User A does NOT own** — typically one of User B's.
   Set its `documentId` as `UNOWNED_PROPERTY_ID`.
5. **At least one report of each type** (one `report-bdtmsd`, one `report-gh`)
   linked to User A's property(ies), and at least one of each linked to User B's,
   so the disjoint-set assertions in AC-3 are meaningful. Each report should have
   a `download` file attached.
6. **Optional — one DRAFT (unpublished) property owned by User A**, set as
   `DRAFT_PROPERTY_ID`. Enables AC-24's absolute "drafts are never served" check
   (stronger than the relative diff). The seed script creates this and prints its
   id; if unset, that one test skips.

> The disjoint-set assertions (AC-1, AC-3) assume A and B own **different**
> properties. If your seed intentionally shares a property between A and B,
> relax those specific assertions — but the standard portal model is per-account
> property assignment.

> **Optional (AC-4 only):** a dedicated throwaway `client` account you are
> willing to block and re-enable. Do **not** reuse User A/B for this.

---

## Environment variables

| Variable | Required | Purpose |
| :-- | :-- | :-- |
| `STRAPI_URL` | yes | Base URL of the Strapi API under test (no trailing slash needed). |
| `USER_A_IDENTIFIER` | yes | Username or email of seeded User A. |
| `USER_A_PASSWORD` | yes | User A's password. |
| `USER_B_IDENTIFIER` | yes | Username or email of seeded User B. |
| `USER_B_PASSWORD` | yes | User B's password. |
| `UNOWNED_PROPERTY_ID` | yes | A property `documentId` User A does **not** own. |
| `DRAFT_PROPERTY_ID` | no | A DRAFT (unpublished) property `documentId` owned by User A. Enables AC-24's absolute draft check; that test skips if unset. |
| `RUN_AC4` | no | Set to `1` to enable the manual AC-4 kill-switch test (otherwise skipped). |
| `AC4_USER_IDENTIFIER` | AC-4 only | Identifier of the dedicated throwaway account to block. |
| `AC4_USER_PASSWORD` | AC-4 only | Its password. |
| `AC4_PAUSE_MS` | no | How long AC-4 pauses for the manual admin toggle (default `30000`). |

A template is provided in `.env.example`.

---

## How to run

Requires Node 18+ (for `node:test` and global `fetch`). No install step.

### macOS / Linux

```bash
cd tests/access-control
STRAPI_URL=https://your-strapi.strapiapp.com \
USER_A_IDENTIFIER=clienta USER_A_PASSWORD=... \
USER_B_IDENTIFIER=clientb USER_B_PASSWORD=... \
UNOWNED_PROPERTY_ID=abcd1234efgh5678ijkl9012 \
npm test
```

Or load a dotenv-style file with Node's built-in loader (Node 20.6+):

```bash
node --env-file=./my.env --test
```

### Windows PowerShell

```powershell
cd tests/access-control
$env:STRAPI_URL        = "https://your-strapi.strapiapp.com"
$env:USER_A_IDENTIFIER = "clienta"; $env:USER_A_PASSWORD = "..."
$env:USER_B_IDENTIFIER = "clientb"; $env:USER_B_PASSWORD = "..."
$env:UNOWNED_PROPERTY_ID = "abcd1234efgh5678ijkl9012"
npm test
```

`npm test` runs `node --test`, which discovers every `*.test.mjs` file in this
directory. To run a single file: `node --test ac-01-properties-scoping.test.mjs`.

### Running AC-4 (manual)

AC-4 is skipped unless `RUN_AC4=1`. The full step-by-step procedure (log in →
baseline 200 → **pause for admin to set `Blocked = true` and Save** → assert the
existing JWT is now rejected and re-login fails → re-enable the account) is
documented at the top of `ac-04-blocked-killswitch.test.mjs`. Use a dedicated
throwaway account, not User A/B, and run it on its own:

```bash
RUN_AC4=1 AC4_USER_IDENTIFIER=blocktest AC4_USER_PASSWORD=... AC4_PAUSE_MS=30000 \
node --test ac-04-blocked-killswitch.test.mjs
```

---

## Scope & constraints

- **Only** the endpoints documented in `03-Technical-Spec.md` §5 are used:
  `POST /api/auth/local`, `GET /api/properties`, `GET /api/properties/:documentId`,
  `GET /api/report-bdtmsds`, `GET /api/report-ghs`.
- No external dependencies; no admin endpoints; no write operations.
- Tests assert concrete outcomes: HTTP status codes, presence/absence of
  specific `documentId`s, disjointness of users' result sets, and the absence of
  forbidden keys (`users`, `email`, `username`, …) and email-like strings in
  populated output.

## Files

| File | Purpose |
| :-- | :-- |
| `package.json` | `"type": "module"` + `"test": "node --test"`; no dependencies. |
| `lib/helpers.mjs` | Shared login + GET helpers and JSON scanners (forbidden-key / email detection). |
| `ac-01-properties-scoping.test.mjs` | AC-1 property list scoping. |
| `ac-02-findone-404.test.mjs` | AC-2 unowned `findOne` → 404, no leak. |
| `ac-03-reports-scoping.test.mjs` | AC-3 report collection scoping. |
| `ac-23-populate-leak.test.mjs` | AC-23 populate cannot reach user accounts. |
| `ac-24-drafts.test.mjs` | AC-24 no drafts/preview via the API. |
| `ac-04-blocked-killswitch.test.mjs` | AC-4 manual kill-switch (optional). |
| `.env.example` | Template for the environment variables. |
