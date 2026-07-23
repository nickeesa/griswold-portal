# Griswold Migration Runbook — Contractor → Client Ownership

> **⚠️ AUTHORITY — read before following any step.** The authoritative operating layer for this
> migration is **`/MIGRATION-START-HERE-for-Grok.md`** (repo root). Where it and this runbook
> differ, **the operating doc wins** and this runbook's generic placeholders are overridden. Key
> overrides:
> 1. **Transfer = Google Drive + re-gitify**, not a `gh`/`git clone` from the contractor. Both
>    repos arrive as plain source with `.git/` already removed; you `git init` and push to the
>    client's own repos (see the Phase 1 note in §6).
> 2. **Frontend (Vercel) env = server-only `STRAPI_URL` + `SESSION_COOKIE_NAME`** (+ optional
>    `SESSION_MAX_AGE_SECONDS`, kept in lockstep with Strapi `JWT_EXPIRES_IN`). There is **NO
>    `NEXT_PUBLIC_STRAPI_URL`** and **NO portal-wide `STRAPI_API_TOKEN`** — the portal authenticates
>    each *user* via Strapi local auth (per-user JWT in an httpOnly cookie). `docs/05` §3.2 is
>    authoritative.
> 3. **Plan C — keep BOTH repos.** Do **not** consolidate into a monorepo and do **not** delete
>    `griswold-portal/strapi/` (its kit is overlaid onto the backend in CI; deleting it breaks the
>    access-control release-blocker job).

**Goal:** Hand full ownership of the Griswold **Strapi** backend and **Portal** frontend to the client. When done, the client independently owns and logs into: two GitHub repos (fresh, in their GitHub), a new Strapi Cloud project, and a new Vercel project. You (the contractor) retain no standing access.

**Prepared:** July 22, 2026 · **Executor:** You, logged in as/with access to the client's accounts.

---

## 0. Confirmed findings & decision updates — July 22, 2026

Inspected the actual `griswold-portal` repo directly. The facts below are **CONFIRMED and supersede any generic assumptions later in this document.** A few backend details remain to be confirmed against the `griswold-strapi` repo in a follow-up session (see "Still to verify").

**Actual repository layout**
- `github.com/scherzo-io/griswold-portal` is a **monorepo handoff package**: `frontend/` (the Next.js app), `strapi/` (a *non-runnable* drop-in kit — schemas, scoped controllers, `config/plugins.js`, seed), `docs/`, `tests/`, and a CI pipeline. Merged to `main` and deployed; delivered to the client via Drive with git history removed (then re-gitified into fresh client repos).
- The runnable backend is a **separate repo, `scherzo-io/griswold-strapi`**, which CI clones via a read-only deploy key (`GRISWOLD_STRAPI_DEPLOY_KEY`) and overlays the kit onto.

**Confirmed stack**
- **Strapi 5, pinned `5.37.0`** (floor 5.37.0; avoid ≥5.50.x — it rejects the legacy `publicationState` query key the code relies on).
- **Upload provider: local** — media served from `*.media.strapiapp.com`. No external bucket; the S3/Cloudinary deletion risk does **not** apply. `strapi transfer` carries the media.
- **Frontend: Next.js 15.2.3** (App Router, React 19, TypeScript), Node ≥20, npm.
- **Portal env vars:** `STRAPI_URL` (server-only, deliberately **not** `NEXT_PUBLIC` — read at runtime), `SESSION_COOKIE_NAME` (`gh_token`), optional `SESSION_MAX_AGE_SECONDS`. **No static Strapi API token** — auth is per-user login (Strapi Users & Permissions JWT in an httpOnly cookie).

**Decision updates (this session)**
- **Repo mapping (Plan C — keep both repos whole):** client `griswold-portal` = the **full package** — the `frontend/` app **plus** the `strapi/` kit, `docs/`, `tests/`, and the CI pipeline (structure unchanged); client `griswold-strapi` = the runnable backend. The kit/overlay model is **kept**, so the **cross-repo access-control CI job carries over**: re-point its hard-coded `scherzo-io/griswold-strapi` clone URL to the client org and recreate the `GRISWOLD_STRAPI_DEPLOY_KEY` deploy key (see `/MIGRATION-START-HERE-for-Grok.md` §6). Do **not** promote `frontend/` to root and do **not** drop the kit/docs/tests.
- **Domain:** **default URLs for now** (`*.vercel.app`, `*.strapiapp.com`). The intended `client.griswoldhospitality.com` is deferred to the optional appendix (§16).

**Corrections to the steps below — read these:**
1. **No build-time trap.** `STRAPI_URL` is server-side/runtime, so §2's "`NEXT_PUBLIC` baked at build time" does **not** apply. You still set `STRAPI_URL` to the new backend and redeploy, but there is no client-bundle inlining risk (the build doesn't even call Strapi — CI uses a placeholder).
2. **No Portal API token to recreate** (§4/§5). Instead: confirm the client **users + the `client` role + its permissions** arrived with the data transfer; decide `JWT_SECRET` (preserve = users stay logged in; new = they re-login); and keep **`SESSION_MAX_AGE_SECONDS` in lockstep with Strapi `JWT_EXPIRES_IN`** (audit finding M12).
3. **CORS is defense-in-depth, not required for function** — the browser never calls Strapi directly (server-side fetch + a media proxy). When you touch it, update the `PROD_ORIGIN` and `VERCEL_PROJECT` slug constants in the backend's `config/middlewares.js` to the client's new Vercel slug.
4. **Vercel root directory = `frontend`** — the Next app stays at `griswold-portal/frontend/` (Plan C; not promoted to repo root).
5. The repo already ships `docs/05-Setup-and-Deployment.md` and `docs/08-Go-Live-Checklist.md` — reuse them; this runbook only adds the ownership-transfer specifics.

**Still to verify against `griswold-strapi` (next session, via GitHub):** exact Strapi version in its `package.json`; that its `config/plugins.js` / `middlewares.js` / `database.js` match the kit (kit↔companion parity still matters — the kit is **kept** and CI overlays it); its `.env.example`; and its own CI / secrets / deploy-key setup.

---

## 1. Decisions locked in

These came from the kickoff Q&A and shape every step below.

| Decision | Choice | Consequence |
|---|---|---|
| GitHub repos | **Fresh repos, code only (Plan C — keep both whole)** | Two client-org repos: **`griswold-portal`** = the full package (`frontend/` + `strapi/` kit + `docs/` + `tests/` + CI) and **`griswold-strapi`** = backend. Kit/overlay kept; the cross-repo access-control CI job carries over (re-point its clone URL + recreate `GRISWOLD_STRAPI_DEPLOY_KEY`). Single clean commit; no history/issues/PRs. |
| Strapi data | **Code + all content & media** | Full database content and uploaded media replicated to the new Strapi Cloud project (local provider → media travels with `strapi transfer`). |
| Domains | **Default URLs for now** | Hand off on `*.strapiapp.com` / `*.vercel.app`. The intended `client.griswoldhospitality.com` is deferred to the optional appendix (§16). No DNS work in the main flow. |
| Execution | **You have access to client accounts** | You execute end-to-end while logged into the client's GitHub, Strapi Cloud, and Vercel. |

---

## 2. Architecture & dependency map

```
  griswold-strapi (repo)  ──▶  Strapi Cloud project  ──┐
                                (managed Postgres +     │ API URL (per-user JWT)
                                 media storage)         ▼
  griswold-portal (repo)  ──▶  Vercel project  ── consumes ──▶ Strapi API
```

**The ordering that matters most:** the new Strapi Cloud project must be live, populated, and reachable before the Portal points at it — the Portal needs a working backend URL to run. Per §0, `STRAPI_URL` is a **server-side runtime** variable (not a build-time `NEXT_PUBLIC_` value), so changing it just needs a redeploy — there is no client-bundle inlining trap. Order: GitHub repos → Strapi Cloud (backend live + data) → Vercel (frontend pointed at new backend) → wire-up → verify → decommission old.

---

## 3. The three unknowns — RESOLVED (see §0)

Confirmed by inspecting the `griswold-portal` repo: **Strapi 5.37.0**, **local upload provider**, and Portal var **`STRAPI_URL`** (server-only) + `SESSION_COOKIE_NAME`, with **no API token**. The verification commands below are retained so you can re-confirm against the `griswold-strapi` backend repo in the next session.

**A. Strapi major version (v4 vs v5).** Determines transfer/upgrade behavior and config layout.
```bash
# in the griswold-strapi clone
cat package.json | grep '@strapi/strapi'
node -p "require('./package.json').engines?.node"   # note the Node version too
```
> If **v4**: it reached end-of-support in April 2026 — ideally upgrade to v5, but **do the data move and the version upgrade as two separate, backed-up steps**, never at once. Data transfer requires the *same* version on both ends.

**B. Strapi upload provider (local vs cloud).** Determines how media migrates and whether there's a deletion risk.
```bash
# in the griswold-strapi clone
grep -R "provider" config/plugins.* config/env 2>/dev/null
grep -R "provider-upload" package.json
```
> **Local provider** (no `@strapi/provider-upload-*` dependency): media is streamed and stored by the destination during transfer — nothing extra to do. **S3/Cloudinary**: the new project must use a **separate, isolated bucket/account** (see Phase 4 warning) or you risk permanently deleting production media.

**C. Portal → backend env var names.** You must repoint these exactly.
```bash
# in the griswold-portal clone
cat .env.example 2>/dev/null; cat .env.local.example 2>/dev/null
grep -R "STRAPI\|API_URL\|process.env" next.config.* src app 2>/dev/null | grep -i "url\|token\|strapi"
```
> **This project (confirmed — see §0; `docs/05` §3.2 is authoritative):** the only Portal env vars are `STRAPI_URL` (server-only, **no** `NEXT_PUBLIC_` prefix — read at runtime, *not* baked at build time), `SESSION_COOKIE_NAME` (default `gh_token`), and optional `SESSION_MAX_AGE_SECONDS` (keep in lockstep with Strapi `JWT_EXPIRES_IN`). **There is no `NEXT_PUBLIC_STRAPI_URL` and no portal-wide `STRAPI_API_TOKEN`** — auth is per-user (Strapi local login → JWT in an httpOnly cookie). Also check `next.config` `images.remotePatterns`/`domains` for a pinned old media host — that must be updated to the new `*.media.strapiapp.com`.

---

## 4. Prerequisites & access checklist

Before Phase 1, confirm you have all of the following. Missing items block the migration.

- [ ] **Client GitHub**: an org (or account) where you can create repos. Your role must be **Org Owner** or **Member with repo access** (an *Outside Collaborator cannot* import into Vercel later). Ability to install GitHub Apps on the org.
- [ ] **Client Strapi Cloud**: login credentials (or your own login added to their account). A **credit card** for billing — **the Strapi Cloud free plan was removed July 1, 2026; there is no free tier or trial.**
- [ ] **Client Vercel**: login, on a **Pro** team (Hobby is disallowed here — it forbids commercial/paid-contractor use *and* can't deploy private org repos).
- [ ] **Source of truth for all secrets**: the contractor's current `.env` files / password manager / existing dashboards. GitHub never reveals secret values, so you re-enter them from here.
- [ ] **`gh` CLI and `git`** installed locally; ability to authenticate `gh` as the client identity.
- [ ] **`gitleaks`** installed (`brew install gitleaks`) for the pre-push secret scan.
- [ ] Access to the **contractor's old** Strapi Cloud + Vercel + GitHub (to pull data and later decommission).
- [ ] Written **client sign-off checkpoint** agreed (you'll pause at Phase 5 before destroying anything).

---

## 5. Secrets & variables inventory

Fill this in before you start; it's your single reference during setup. **Do not commit any of this to git.**

| Variable | Where it lives | New value strategy |
|---|---|---|
| `APP_KEYS` | Strapi Cloud → Settings → Variables | **New** auto-generated value (fine). Only invalidates old session cookies. |
| `ADMIN_JWT_SECRET` | Strapi Cloud | **New** (fine). Admins log in fresh anyway. |
| `API_TOKEN_SALT` | Strapi Cloud | **New** (fine). API tokens aren't migrated; you'll recreate them. |
| `TRANSFER_TOKEN_SALT` | Strapi Cloud (auto-set) | Leave as auto-generated; just needs to exist so you can mint a transfer token. |
| `JWT_SECRET` | Strapi Cloud | **Preserve old value** *only if* you want end-users' existing "stay logged in" sessions to survive; otherwise new is fine (users just re-login). |
| `ENCRYPTION_KEY` | Strapi Cloud | **Preserve old value** *only if* the repo uses it to encrypt data stored in the DB (grep for `ENCRYPTION_KEY`/`encryptionKey` beyond standard admin config). Otherwise new is fine. |
| `DATABASE_*` | **Do NOT set on Strapi Cloud** | Leave unset — Cloud auto-injects its managed Postgres. Setting any `DATABASE_*` makes Cloud assume an external DB. |
| Upload provider creds (`AWS_*` / `CLOUDINARY_*`) | Strapi Cloud (only if provider used) | New isolated bucket/account creds (see Phase 4 warning). |
| Portal `STRAPI_URL` | Vercel → Env Vars | **New** Strapi Cloud URL. **Server-only (no `NEXT_PUBLIC_`)**, read at runtime — a redeploy (not a rebuild) picks up changes. `docs/05` §3.2 is authoritative. |
| Portal `SESSION_COOKIE_NAME` (+ optional `SESSION_MAX_AGE_SECONDS`) | Vercel → Env Vars | Cookie name holding the per-user JWT (default `gh_token`); keep `SESSION_MAX_AGE_SECONDS` in lockstep with Strapi `JWT_EXPIRES_IN`. **There is no portal-wide `STRAPI_API_TOKEN`** — auth is per-user (Strapi local login → httpOnly-cookie JWT). |

---

## 6. Phase 1 — Fresh GitHub repos (code only)

**Outcome:** `client-org/griswold-strapi` and `client-org/griswold-portal` exist as private repos, each with one clean commit, owned by the client org.

> **⚠️ Delivery override (see `/MIGRATION-START-HERE-for-Grok.md`):** the code is delivered via
> **Google Drive with `.git/` already removed**, and both repo folders are **already present** on
> the client's machine. So **skip the clean-clone in §1.1–1.3** — there is nothing to clone from the
> contractor. Instead, in each repo folder already here: run the secret hygiene in §1.4 →
> `git init -b main && git add -A && git commit -m "Initial commit"` →
> `gh repo create CLIENT-ORG/<name> --private --source=. --push` → verify ownership (§1.5).
> Removing `.git` already wiped contractor history, so this *is* the clean-history start §1 wants.

### 1.1 Authenticate as the client (critical)
```bash
gh auth login                    # log in as the client identity
# or: export GH_TOKEN=<client_PAT>   (scopes: repo, delete_repo, admin:org, workflow)
gh api user --jq .login          # MUST print the client account, not yours
```

### 1.2 Create empty private repos in the client org
Create them **directly in the org** (don't create-then-transfer — that leaves redirects and a moment of contractor ownership). Leave README/gitignore/license **unchecked** so the first push is clean.
```bash
gh repo create CLIENT-ORG/griswold-strapi --private
gh repo create CLIENT-ORG/griswold-portal --private
```

### 1.3 For each repo: clean clone → secret hygiene → single commit → push
```bash
# 1) Fresh clone of the contractor's current default branch
git clone https://github.com/CONTRACTOR/griswold-strapi.git
cd griswold-strapi

# 2) SECRET HYGIENE (do this BEFORE git add) — see 1.4
#    - fix .gitignore, delete any tracked .env, scan

# 3) Wipe history, re-init
rm -rf .git
git init -b main

# 4) Stage, then VERIFY nothing sensitive/bulky is staged
git add -A
git status        # confirm NO .env, node_modules/, .next/, build/, .strapi/, *.sqlite

# 5) One clean commit
git commit -m "Initial commit"

# 6) Point at the client repo and push ONLY main
git remote add origin https://github.com/CLIENT-ORG/griswold-strapi.git
git push -u origin main
```
Repeat for `griswold-portal`. Pushing only `main` guarantees no old history reaches the new remote (the first branch pushed also becomes the default branch).

### 1.4 Secret hygiene details
- **Next.js `.gitignore` gotcha (highest-risk leak here):** create-next-app ignores `.env*.local` but **NOT a bare `.env`**. If the Portal has a plain `.env`, add an explicit `.env` line to `.gitignore` and delete the on-disk file before `git add`. (Strapi's default `.gitignore` *does* ignore `.env`.)
- **Scan before pushing:**
  ```bash
  gitleaks detect --source . -v          # scans history (run while .git still exists)
  gitleaks detect --no-git --source . -v # scans files on disk (after re-init)
  ```
- Eyeball non-`.env` hotspots: Strapi `config/*.js` (keys/salts), `.npmrc`, service-account JSON, hardcoded keys.
- **If any secret was ever committed, rotate/revoke it** — scrubbing history doesn't help because the contractor's old clones/remote still contain it.

### 1.5 Verify ownership
```bash
gh repo view CLIENT-ORG/griswold-strapi \
  --json nameWithOwner,owner,isPrivate,defaultBranchRef,isFork,parent
# Expect: owner.login == CLIENT-ORG, owner.type == "Organization",
#         isPrivate == true, defaultBranchRef.name == "main", isFork == false
```

### 1.6 Recreate repo config that code does NOT carry
A fresh push carries only code. Recreate on each new repo as needed: **branch protection/rulesets**, GitHub Actions **secrets/variables**, **environments**, **deploy keys**, **webhooks**, **collaborators/teams**, repo settings, default branch. Re-enter secret *values* from your source of truth. (Do this now for anything CI needs; Strapi Cloud/Vercel wiring happens in later phases.)

---

## 7. Phase 2 — New Strapi Cloud project + data & media migration

**Outcome:** A client-owned Strapi Cloud project running the `griswold-strapi` code, on managed Postgres, with all content + media replicated, and its own admin login.

### 2.1 Create the project
1. Log into **https://cloud.strapi.io as the client** (first login creates their account → guarantees ownership).
2. **Create project** → connect the client's GitHub → authorize the Strapi Cloud GitHub app on **`CLIENT-ORG`** → select repo `griswold-strapi`.
3. Configure:
   - **Git branch**: production branch (e.g. `main`)
   - **Region**: choose carefully — **permanent, cannot change later**
   - **Base directory**: **repo root** — `griswold-strapi` is a root-level Strapi project (not in a subfolder)
   - **Node version**: match the value you found in §3A
   - **Deploy on push**: your preference (can change later)
4. **Billing** — pick a plan. **No free tier exists anymore.** Recommendation to raise with the client:
   - **Starter (~$35/mo):** sleeps when idle (**cold starts**) and has **no backups** — risky for a live site, and cold starts can make the Portal's build-time/SSR fetches slow or fail during and after migration.
   - **Pro (~$90/mo):** always-on + weekly backups — recommended for production.
   - (The pricing page shows **Starter / Pro / Business**; internal plan slugs are `essential`/`pro`/`scale`, so older docs may use those names. Verify limits at checkout.)
5. Subscribe → first deploy runs automatically. Watch build logs; if the Node version or build fails, fix and retry.

### 2.2 Environment variables on Cloud
- Strapi Cloud auto-populates the six secrets (`APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY`) as regenerable defaults. Per §5, new values are fine — **preserve only `JWT_SECRET` and/or `ENCRYPTION_KEY`** if the conditions in the table apply.
- **Leave all `DATABASE_*` unset** (managed Postgres is auto-injected).
- Add any custom/app vars and (if applicable) upload-provider creds. **Save & deploy** after changes.

### 2.3 Create the first admin
Admin accounts are **not** migrated. After the first successful deploy, open the admin URL — **have the client register the first super-admin** so they own the top account. Invite additional admins via Settings → Administration Panel → Users (Cloud ships SendGrid, so invites work).

> **You'll need Strapi admin-panel access — not just the Cloud dashboard login — to mint the transfer token (2.4) and API tokens (Phase 3/4).** Have the client invite you as an admin (or temporarily share the super-admin) for the migration. This account is removed in Phase 6.

### 2.4 Migrate content + media with `strapi transfer` (via a local hop)
`strapi import` can't target a remote, and there's no remote→remote command, so relay through a local clone (same version as both projects). Both hops carry **content + media/uploads + config + schema**. Admin users and API tokens are **not** included (expected).

```bash
# 0) Local relay prep
git clone <griswold-strapi repo> griswold-local && cd griswold-local
npm install
#   create a local .env with a local DB (sqlite is fine) + any TRANSFER_TOKEN_SALT value

# 1) PULL production data from the OLD (contractor) Cloud project into local
#    In the OLD admin panel: Settings > Transfer Tokens > create a "Pull" or "Full" token.
npm run strapi transfer -- --from https://OLD-project.strapiapp.com/admin
#    paste the OLD token when prompted  (this WIPES local data first — fine, throwaway)

# 2) SAFETY snapshot of the pulled data (rollback artifact)
npm run strapi export -- -f griswold-backup     # prompts for an encryption key; keep it safe

# 3) PUSH from local into the NEW (client) Cloud project
#    In the NEW admin panel: Settings > Transfer Tokens > create a "Push" or "Full" token.
npm run strapi transfer -- --to https://NEW-project.strapiapp.com/admin
#    paste the NEW token; confirm the delete prompt (it WIPES the new project first — expected)
```
> Transfer tokens are shown **once** — copy immediately. The destination URL must end in **`/admin`**. Use token **type** Pull for `--from`, Push for `--to`.

### 2.5 Verify the backend
- In the new admin: **Content-Type Builder** shows all types (a completed transfer already proves schemas match).
- **Content Manager**: spot-check entry counts per major collection vs. the old project; check draft/published and locales if used.
- Open entries with relations/components/dynamic zones — confirm they resolve.
- **Media Library**: asset count matches; thumbnails/files load.
- Hit REST/GraphQL on the new URL with a freshly minted API token; compare payloads to the old site.
- Keep the encrypted `griswold-backup` archive as rollback.

---

## 8. Phase 3 — New Vercel project (Portal)

**Outcome:** A client-team-owned Vercel project building `griswold-portal` from the new repo, deployed and pointed at the **new** Strapi backend.

### 3.1 Create the project under the client's team
1. Log into the client's Vercel; **select the client's team** in the scope switcher *before* importing (the team selected at creation owns the project).
2. **New Project** → install/authorize the Vercel GitHub app on **`CLIENT-ORG`** → select `griswold-portal`.
3. Configure the import:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: **`frontend`** — the Next.js app lives in `griswold-portal/frontend/` (Plan C keeps the two-repo layout; do not promote it to the repo root)
   - **Build/Output**: leave auto unless the old project overrode them
   - **Node.js version** (Settings → Build & Deployment): match the old project (new projects default to latest LTS, currently 24.x)

### 3.2 Environment variables (before the first build)
Set in the import screen or Settings → Environment Variables, scoped to **Production and Preview** (bulk-paste `KEY=value` or import a `.env`):
- **`STRAPI_URL`** → the **new** `https://NEW-project.strapiapp.com`. **Server-only — no `NEXT_PUBLIC_` prefix** (read server-side at runtime, so it is *not* baked into the client bundle; a redeploy picks up changes). `docs/05` §3.2 is authoritative.
- **`SESSION_COOKIE_NAME`** (default `gh_token`) and optional **`SESSION_MAX_AGE_SECONDS`** (keep in lockstep with Strapi `JWT_EXPIRES_IN`). **Do not mint or set a portal-wide `STRAPI_API_TOKEN`** — the portal authenticates each user via Strapi local auth and uses that user's JWT (httpOnly cookie).
- Update `next.config` image host allow-list to the new `*.media.strapiapp.com` if it was pinned.

### 3.3 Deploy & verify
- Trigger the deploy; confirm the latest production-branch build shows **Ready / Current** at `https://<project>.vercel.app`.
- **If the Portal makes client-side (browser) calls to Strapi, do the CORS step (Phase 4, first bullet) now** — the new `*.vercel.app` origin is known once the project exists, and browser fetches stay blocked until CORS allows it. Pure server-side (SSR) apps can skip this.
- **Confirm it's hitting the NEW Strapi:** open the site → DevTools → Network (Fetch/XHR) → requests go to the new `strapiapp.com` host. For server-side calls, check Vercel Runtime Logs and confirm rendered content matches new-Strapi data with no 401/403.

---

## 9. Phase 4 — Wire-up (the connections code doesn't carry)

- **CORS on the new Strapi**: allow the new `*.vercel.app` origin, or client-side fetches fail. CORS usually lives in the repo (`config/middlewares.js`), so this is often a code commit + redeploy, not a dashboard toggle. If the Portal fetches client-side, also confirm the Users & Permissions **Public** role grants read on the consumed content types.
- **API tokens**: **the Portal itself uses no portal-wide API token** (it authenticates each user via Strapi local auth → per-user JWT in an httpOnly cookie), so there is nothing to mint or re-key for the Portal here. In this phase, create tokens only for any *other* consumers/integrations that weren't migrated, and update each with its new string.
- **Deploy hooks / rebuild webhooks**: deploy hooks don't migrate. If the old setup rebuilt the Portal when Strapi content changed, recreate the Vercel deploy hook (Settings → Git → Deploy Hooks) and **update the Strapi webhook to the new hook URL**.
- **CI/integrations**: recreate any GitHub Actions/Slack/monitoring integrations that referenced old project IDs or tokens.

> **⚠️ Media deletion warning (S3/Cloudinary only):** if the new Strapi project shares the **same bucket/account** as the old one, the transfer's destination-wipe can **permanently delete production media** via the provider's delete API. Point the new project at an **isolated bucket/account**, or keep the old bucket read-only. (Not a concern for the default local provider.)

---

## 10. Phase 5 — End-to-end verification (client sign-off checkpoint)

Do not decommission anything until all of these pass and the client signs off.

- [ ] Both new repos are private, client-org-owned, single clean commit, no secrets committed.
- [ ] New Strapi Cloud project: content counts, media, relations, locales, roles/permissions all match the old project.
- [ ] Client can log into the new Strapi admin with their own super-admin account.
- [ ] New Vercel site loads and is confirmed talking to the **new** Strapi (Network tab + runtime logs), no 401/403.
- [ ] Content change in new Strapi → rebuild webhook fires → Portal reflects it (if that workflow existed).
- [ ] Billing for both Strapi Cloud and Vercel is on the **client's** payment method.
- [ ] All three services are owned by the client, and you are not the sole admin/owner anywhere.
- [ ] **Client sign-off received.**

---

## 11. Phase 6 — Decommission & sever contractor access

Only after Phase 5 sign-off. Keep old projects as rollback for a short grace period first.

**Decommission old services**
- **Vercel (old):** old project → Settings → Advanced → Delete Project. Confirm nothing still points at it first. Irreversible.
- **Strapi Cloud (old):** Project → Settings → General → Danger zone → Delete project. Irreversible; auto-cancels the subscription (stops billing your card).
- **GitHub (old):** `gh repo archive CONTRACTOR/griswold-strapi` (reversible), then delete later once confident (`gh repo delete ... --yes`; ~90-day restore window; deleting a private repo also deletes its forks).

**Sever your access + rotate** — do all of these; "remove member" alone is not enough.
- Remove yourself as collaborator/member from the client's GitHub org, Vercel team, and Strapi Cloud project.
- **Delete your Strapi admin-panel user** (the account from 2.3's invite) and any admin created for the migration. Rotating `ADMIN_JWT_SECRET` only ends active sessions — it does **not** remove a user whose email/password you know; they could simply log back in.
- **If you ever used the client's own credentials, the client must change those passwords and reset 2FA** on GitHub, Vercel, Strapi Cloud, and the Strapi admin panel. Secret rotation does not revoke a known-credential login.
- Uninstall your GitHub Apps/OAuth grants; revoke your PATs, deploy keys, and Vercel/Strapi access tokens.
- **Rotate secrets** on the client side (Strapi `APP_KEYS`/`ADMIN_JWT_SECRET`/`API_TOKEN_SALT`/`JWT_SECRET`, third-party keys, Strapi API tokens). Rotate `ENCRYPTION_KEY` **only if it is NOT used to encrypt transferred data-at-rest** (otherwise rotation corrupts that data — see §5). Rotate DB creds **only** on an external database (managed Postgres creds aren't user-managed). Removing access does not retrieve clones you already hold — rotation is the real cut-off, mandatory if any secret ever lived in the code.
- Delete the transfer tokens and any temporary API tokens created during migration in both projects.

---

## 12. Rollback plan

- **Nothing is destroyed until Phase 6**, so rollback before then = simply keep using the old projects; they're untouched and still live.
- **Strapi data**: the encrypted `griswold-backup` archive (Phase 2.4 step 2) can be re-imported to a local instance to recover content if a transfer goes wrong.
- **Portal**: if it points at the wrong backend, fix `STRAPI_URL` and **redeploy** — it's a server-only runtime var, so a redeploy is enough (no rebuild; nothing is baked into the client bundle).
- **GitHub**: the contractor's originals remain (archived, not deleted) during the grace period — re-clone if needed.

---

## 13. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Next.js bare `.env` committed to new repo | Medium | High | Add `.env` to `.gitignore`, delete on disk, gitleaks scan before push (§6.4). |
| Portal points at old/ wrong Strapi URL | Medium | Medium | `STRAPI_URL` is a server-only runtime var (not baked) — set it correctly, verify via runtime logs / Network tab, and **redeploy** if wrong (§8, §12). |
| Transfer wipes the wrong instance | Low | Critical | Transfer deletes the destination first — triple-check `--to`/`--from` URLs; keep the export backup (§7). |
| Shared S3/Cloudinary bucket → media deleted | Low | Critical | Use an isolated bucket/account for the new project (§9 warning). |
| Assuming API tokens/admins migrate | Medium | Medium | They don't — recreate tokens, re-key Portal, client registers fresh admin (§5, §7.3, §9). |
| Strapi v4↔v5 mismatch during transfer | Low | High | Confirm version (§3A); move data and upgrade as separate steps. |
| Vercel project created under contractor scope | Low | Medium | Select client team before import; verify ownership (§8.1). |
| Contractor retains access after handoff | Medium | High | Remove membership, **delete your Strapi admin user**, rotate secrets, and have the client **reset their own passwords + 2FA** if you ever used their credentials (§11). |
| Strapi Cloud region regret | Low | Medium | Region is permanent — pick correctly at creation (§7.1). |
| Billing left on contractor's card | Medium | Medium | Verify client payment method on both platforms (§10). |

---

## 14. Quick sequence (one-screen version)

1. Confirm the 3 unknowns (Strapi version, upload provider, Portal env var names).
2. Auth `gh` as client → create 2 empty private repos in client org.
3. Clean-clone → secret scan → `rm -rf .git` → `git init` → commit → push `main`. Verify ownership.
4. Create client Strapi Cloud project from new repo → pick paid plan → set vars → deploy → client creates admin.
5. `strapi transfer` old→local→new (content + media). Verify backend. Keep export backup.
6. Create client Vercel project from new repo (client team) → env vars point at **new** Strapi URL + new token → deploy → verify it hits new backend.
7. Wire-up: CORS, recreate API tokens, deploy/rebuild hooks.
8. End-to-end verify → **client sign-off**.
9. Decommission old Vercel/Strapi/GitHub → remove your access → rotate all secrets.

---

## 15. Reference — official docs

**GitHub:** repo create/delete/settings — cli.github.com/manual · docs.github.com (creating a repository, rulesets, archiving/deleting, secret scanning). Scrubbing: git-filter-repo, BFG, gitleaks.
**Strapi:** Data Management / transfer / export / import — docs.strapi.io/cms/data-management · Environment & admin-panel config (salts/keys) · Cloud deployment, settings (variables/ownership/backups/delete), managed database, upload provider · Free-plan removal (strapi.io/blog) · Pricing (strapi.io/pricing-cloud).
**Vercel:** Git & Vercel-for-GitHub · Configure a Build · Node.js versions · Environment variables (managing, sensitive, across environments, bulk upload) · Deploy Hooks · Hobby vs Pro & Fair-Use commercial-usage · Project transfer · Delete project / remove team member.
**Next.js:** environment-variables (build-time inlining of `NEXT_PUBLIC_*`).
