# Luxury Hotel Audit — Client Portal
## Admin Runbook ("Dana")

---

### Document Control

| | |
| :-- | :-- |
| **Document** | Admin Runbook |
| **Project** | Luxury Hotel Audit — Client Portal |
| **Client** | Griswold Hospitality |
| **Version** | 2.1 |
| **Status** | For Use |
| **Date** | June 23, 2026 |
| **Audience** | "Dana", Portal Administrator (internal) — Strapi admin panel only |
| **Related documents** | `01-PRD.md`, `03-Technical-Spec.md`, `05-Setup-and-Deployment.md` |

> This is the day-to-day operator's manual. It assumes the backend is already deployed and the `client` role and permissions exist (see `05-Setup-and-Deployment.md`). All steps happen in the **Strapi admin panel**; Dana never touches the client portal (`01-PRD.md` §3.1). Field names below are the exact schema field names — use them verbatim.

---

### Table of Contents
1. Before You Start
2. Procedure A — Create a client user (< 60s)
3. Procedure B — Reset a password
4. Procedure C — Revoke access (three ways)
5. Procedure D — Add & publish a report (both types)
6. Procedure E — Set a property's performance dashboards & info
7. Publishing Gotcha — publish the whole graph
8. Troubleshooting
9. Procedure → Requirement Map

---

## 1. Before You Start

- **You only need the admin panel.** Content Manager (left nav) holds Property, Reports BDTMSD, Reports GH, Location; Users & Permissions Plugin → Users holds client accounts.
- **No email is ever sent.** There is no automated mail, no verification, no self-service reset (`01-PRD.md` C1/C2). You communicate every credential and password **out-of-band** (phone, secure message) yourself.
- **Passwords are one-way.** Strapi stores them hashed (bcrypt); once saved they **cannot be viewed or recovered** — only overwritten (`01-PRD.md` §16, FR-5.2).
- **Published vs. draft matters.** The portal API serves **published** content only (`03-Technical-Spec.md` §3.1). A drafted property or report is invisible to clients. Save is not enough — you must **Publish**.

---

## 2. Procedure A — Create a client user (< 60s)
**Maps to:** FR-5.1, AC-19 (target metric: under 60 seconds), DD-1, DD-3.

Go to **Settings → Users & Permissions Plugin → Users** is read-only for create; create users under **Content Manager → Users** (the Users-Permissions user collection). Click **Create new entry**.

| Step | Field | Value / Action | Notes |
| :-- | :-- | :-- | :-- |
| 1 | `username` | The login ID, e.g. `fourseasonsmaui` | Unique; min 3 chars. This is what the client types in the "Username" field (FR-1.1). |
| 2 | `email` | A **distinct placeholder**, e.g. `fourseasonsmaui@noreply.griswoldhospitality.com` | **Required and unique.** Never contacted. A duplicate placeholder **fails Strapi's unique-email constraint** — give every account its own (`01-PRD.md` §7.2, DD-3). Min 6 chars. |
| 3 | `password` | A strong, admin-chosen password | Min 6 chars. Stored hashed; not retrievable later (§16). |
| 4 | `confirmed` | Toggle to **true** | Login is **rejected** if `confirmed` is false (FR-1.5). New users default to `false` — you must flip it. |
| 5 | `blocked` | Leave **false** | `true` would revoke access (kill switch). Default is false. |
| 6 | `role` | Select **`client`** | The single client-facing role. Never assign the admin role. |
| 7 | `properties` | Add one or more from the relation picker | **This relation is the access-control model** (`01-PRD.md` §7.1). The user sees exactly these properties and nothing else. |
| 8 | `full_name` | *(optional)* internal contact name | Internal tracking only; never shown to clients (DD-8). |
| 9 | — | **Save** | Account is live immediately. |

**Then:** share `username` + `password` **out-of-band** (FR-5.1, DD-2). Do not email them.

> Speed tip: tab through `username` → `email` → `password`, flip `confirmed`, set `role`, attach `properties`, Save. That is the path that hits the < 60s metric (AC-19).

---

## 3. Procedure B — Reset a password
**Maps to:** FR-5.2, AC-20, DD-2, `01-PRD.md` §16 (item 1).

There is **no "view old password" and no "send reset email."** Both are impossible by design.

1. **Content Manager → Users** → open the user.
2. In the `password` field, type a **new** value (the old one is unreadable — it was hashed; §16).
3. **Save.**
4. Communicate the new password **out-of-band** (FR-5.2). The client logs in with it immediately (AC-20); no email is involved (C1).

> If a client says "I forgot my password," you do **not** look it up — you set a new one and tell them. This is the only reset path (DD-2).

---

## 4. Procedure C — Revoke access (three ways)
**Maps to:** FR-5.3, FR-2.5, AC-4, DD-6.

Pick the option matching how permanent the revocation is.

| # | Method | How | Effect | When to use |
| :-- | :-- | :-- | :-- | :-- |
| 1 | **`blocked = true`** (instant kill switch) | Open the user → toggle `blocked` to **true** → Save | Revokes access on the user's **next request**, not just at next login. Strapi re-checks `blocked` from the database on **every** authenticated request, so an already-issued token stops working immediately (FR-2.5, AC-4, `03-Technical-Spec.md` §3.5). Account and data are preserved. | Temporary suspension; emergency containment of a suspected leak. |
| 2 | **Remove a property assignment** (scope down) | Open the user → in `properties`, remove the property → Save | The user keeps their account and other properties but **can no longer see the removed one** — the access relation is gone. | Engagement ends for one property but the client retains others. |
| 3 | **Delete the user** (permanent) | Open the user → **Delete entry** | Account and its `properties` links are gone. Irreversible. | Permanent off-boarding; no need to retain the account. |

> To **re-enable** a blocked user, set `blocked` back to **false** and Save. To restore scope, re-add the property to `properties`.

---

## 5. Procedure D — Add & publish a report (both types)
**Maps to:** FR-5.4, FR-5.5, AC-14, AC-21.

There are two report content types. **Reports BDTMSD** and **Reports GH** share the same fields; **Reports GH additionally has `spa_score`** (`01-PRD.md` §7.5). Decide which type the audit is, then create the matching entry.

### 5.1 Reports BDTMSD
**Content Manager → Reports BDTMSD → Create new entry.**

| Step | Field | Value / Action |
| :-- | :-- | :-- |
| 1 | `type` | The report label, e.g. `Q4 2025 Luxury Audit Report` (shown on the Reports tab). |
| 2 | `date` | Audit / publication date (drives "latest" sorting on the card — FR-3.5). |
| 3 | `performance_score` | Overall decimal score, e.g. `87.26`. |
| 4 | `download` | **Upload** the PDF (single file). This is what the client's Download action serves via the proxy route. |
| 5 | `full_report` | Paste the URL to the full interactive report (opens in a new tab — FR-4.4). |
| 6 | `properties` | Link to the property/properties this report belongs to (relation). |
| 7 | — | **Save**, then **Publish**. |

### 5.2 Reports GH
**Content Manager → Reports GH → Create new entry.** Same as above **plus**:

| Step | Field | Value / Action |
| :-- | :-- | :-- |
| 3b | `spa_score` | Separate spa performance decimal, e.g. `88.0`. **GH only** — BDTMSD has no spa score (AC-14). |

All other fields (`type`, `date`, `performance_score`, `download`, `full_report`, `properties`) are filled exactly as in 5.1, then **Save & Publish**.

> A published report appears on the portal with **no code deployment** (FR-5.5, AC-21) — the frontend fetches live data on every request. If it does not appear, see §6 and §7.

---

## 6. Procedure E — Set a property's performance dashboards & info
**Maps to:** FR-4.7.

The property detail page has **Hotel Performance**, **F&B Performance**, and **Spa Performance** tabs that **embed a Looker Studio dashboard**, plus a **"?" help link** to a property-info document. All four are driven by free-text fields on the **Property** record. A tab appears **only when its field has content**; an empty field means the tab is hidden (clients never see an empty performance tab).

**Content Manager → Property → open the property.**

| Field | What to paste | Notes |
| :-- | :-- | :-- |
| `hotel_performance` | The Looker Studio **embed URL** for the hotel dashboard, e.g. `https://lookerstudio.google.com/embed/reporting/<id>/page/<page>` | Drives the "Hotel Performance" tab. Use the **Embed** URL (Looker → Share → **Embed report** → copy the `src`), **not** the normal share/edit link. |
| `fb_performance` | Looker **embed URL** for the F&B dashboard | Drives the "F&B Performance" tab. |
| `spa_performance` | Looker **embed URL** for the spa dashboard | Drives the "Spa Performance" tab. |
| `property_info` | A URL to the property-info doc (e.g. a Google Doc) | Renders as the "?" help link on the detail page. Prefer a **view-only** share link. |
| — | **Save**, then **Publish** | The property must be Published to appear (see §7). |

**Critical content rules (why a dashboard might not show):**
- The portal **only embeds `https://lookerstudio.google.com` URLs**, and the value must be the **embed** form. A share/edit link, a legacy `datastudio.google.com` link, or plain text **will not embed** — re-copy it as a Looker *embed* URL. (This host restriction is a deliberate security control, not a bug.)
- Pasting a wrong value never breaks the page; the tab simply hides or shows a plain link instead of the dashboard.
- These are plain-text fields with no formatting — paste only the URL, no surrounding text.

---

## 7. Publishing Gotcha — publish the whole graph
**Maps to:** `03-Technical-Spec.md` §8.2; FR-5.5; AC-21.

The API serves **published** records only, and that applies to **each** record in the graph independently. **Publishing a report alone is not enough** if the things it hangs off are still drafts.

When you make a property's data live, **publish the whole set together**:

1. **The Property** record itself (a drafted property never appears on My Properties).
2. **Each linked Report** (BDTMSD and GH) you want visible (a drafted report is omitted from the Reports tab).
3. After changing the **User ⇄ Property relation** (e.g., assigning a new property), make sure the **Property** is published.

If you publish only some of these, the client sees a **partial or empty list** — for example a property card with no reports, or no card at all. Always confirm Property + its Reports are all in the **Published** state.

---

## 8. Troubleshooting

Symptoms a client reports, and the field to check (in order). All checks are in the Strapi admin panel.

| Symptom | Check 1 | Check 2 | Check 3 |
| :-- | :-- | :-- | :-- |
| **Can't log in** | `confirmed = true`? (false blocks login — FR-1.5) | `blocked = false`? (true revokes — FR-2.5) | Right `username`/password? Reset per §3 if unsure. `role = client`? |
| **Sees no properties / empty My Properties** | Does the user's `properties` relation list any properties? (no assignment → empty state — FR-3.7) | Is each assigned **Property published**? (draft → hidden — §6) | Correct user account (not a stale/duplicate one)? |
| **Sees a property but empty reports** | Are the `reports_bdtmsds` / `reports_ghs` **linked** to that property? | Are those **reports published**? (draft → omitted — §6) | Do the reports have a `date`? (drives sorting/latest — FR-3.5) |
| **Property shows no location name** | Is the property's `location` relation set? | Is the **Location published**? | (Location read is granted to `client` and scoped — see `05-Setup-and-Deployment.md` §1.) |
| **A specific property URL shows "not found"** | Is that property in the user's `properties`? An unassigned property correctly returns 404 by design (FR-2.2, AC-18) — assign it if access is intended. | Is the property published? | — |
| **A performance tab is missing or the dashboard is blank** | Is the matching field (`hotel_performance` / `fb_performance` / `spa_performance`) filled? Empty → tab hidden by design (§6). | Is the value a **Looker `lookerstudio.google.com` embed URL**? A share/edit link, `datastudio.google.com`, or plain text won't embed (§6). | Is the property published? |

> Reminder: you can never "see" or recover a password to verify it (§3). When in doubt about a login problem, set a fresh password and re-share.

---

## 9. Procedure → Requirement Map

| Procedure | Primary FR | Acceptance / Decision |
| :-- | :-- | :-- |
| A — Create a client user (< 60s) | FR-5.1 | AC-19, DD-1, DD-3 |
| B — Reset a password | FR-5.2 | AC-20, DD-2, §16 (1) |
| C1 — `blocked = true` | FR-5.3, FR-2.5 | AC-4, DD-6 |
| C2 — Remove property assignment | FR-5.3 | FR-2.1 |
| C3 — Delete user | FR-5.3 | DD-6 |
| D — Add & publish a report | FR-5.4, FR-5.5 | AC-14, AC-21 |
| E — Set performance dashboards & info | FR-4.7 | — |
| Publish whole graph | FR-5.5 | AC-21, Tech Spec §8.2 |
| Troubleshooting | FR-1.5, FR-2.5, FR-3.7 | AC-9, AC-13, AC-18 |
