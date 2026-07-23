# Luxury Hotel Audit — Client Portal
## Product Requirements Document (PRD)

---

### Document Control

| | |
| :-- | :-- |
| **Document** | Product Requirements Document |
| **Project** | Luxury Hotel Audit — Client Portal (Property-Based Auth & Reporting) |
| **Client** | Griswold Hospitality |
| **Version** | 2.0 — Consolidated |
| **Status** | For Review |
| **Date** | June 4, 2026 |
| **Portal URL** | `client.griswoldhospitality.com` |
| **Stack** | Strapi 5 (Cloud) · Next.js 15 · Vercel · GitHub · Figma |
| **Related documents** | `03-Technical-Spec.md` |
| **Supersedes** | Product Design & Requirements Document v1.0; Client Portal User Requirements |

**Version history**

| Version | Date | Author | Summary |
| :-- | :-- | :-- | :-- |
| 1.0 (draft) | Apr 3, 2026 | Griswold Hospitality | Original product design & requirements document |
| 1.x | (n/a) | Griswold Hospitality | User requirements companion document |
| 2.0 | Jun 4, 2026 | Consolidated | Merged both source docs; folded in scoping decisions; corrected two technical inaccuracies (§16); added functional/non-functional requirements, data dictionary, user flows, and glossary |

> **Reading note.** This PRD is the canonical *what and why*. It deliberately keeps implementation detail light and defers it to the Technical Specification. Where a requirement has an ID (e.g., `FR-3.2`), that ID is the stable reference used across the documents and in the acceptance criteria.

---

### Table of Contents

1. Executive Summary
2. Purpose, Scope & Objectives
3. Stakeholders & Personas
4. System Overview
5. User Roles & Permissions
6. Functional Requirements
7. Data Model & Content Types
8. Page Architecture & User Flows
9. Administrative Workflows
10. Non-Functional Requirements
11. Authentication & Security (Summary)
12. Assumptions, Dependencies & Constraints
13. Confirmed Decisions (Decision Log)
14. Success Metrics & KPIs
15. Risks (Summary)
16. Corrections to Source Documents
17. Out of Scope & Future Considerations
18. Appendix A — Glossary

---

## 1. Executive Summary

Griswold Hospitality conducts luxury-property audits and produces detailed performance reports for its hotel clients. Today those reports are delivered manually. This project replaces that with a private, branded **client portal**: each hotel client logs in and sees only the properties assigned to them, along with the audit reports and performance data attached to those properties.

The portal is deliberately lightweight. A single internal admin role manages everything inside the Strapi CMS — creating accounts, assigning properties, and publishing reports. Clients have **read-only** access. There is no self-service registration, no automated email, and no complex permission matrix. Access is governed entirely by a relationship between each user and one or more properties, and is **enforced on the server**, not in the browser.

The result is a system an admin can operate in seconds, that exposes each client to exactly their own data, and that lets content change without any code deployment.

---

## 2. Purpose, Scope & Objectives

### 2.1 Purpose
Define the architecture, data model, roles, workflows, requirements, and acceptance criteria for the Client Portal so that the development team can build it without ambiguity and the client can validate it against business needs.

### 2.2 In-scope summary
A login page, a "My Properties" page, and a per-property detail page; a five-content-type Strapi data model with property-based access scoping; admin workflows for accounts and reports; and deployment to Strapi Cloud and Vercel.

### 2.3 Business objectives
- **O1 — Confidentiality.** Each client sees only and exactly their assigned properties' data.
- **O2 — Admin efficiency.** Account creation and property assignment take under a minute, with no developer involvement.
- **O3 — Operational independence.** Content (reports, properties, users) is managed entirely in the CMS; the site reflects changes with no redeploy.
- **O4 — Low operational overhead.** No email infrastructure, no self-service flows, no ongoing per-user maintenance beyond what the admin chooses to do.
- **O5 — A maintainable, professional foundation** that the design and engineering teams can extend (the Figma-to-code workflow, a small reusable component library).

---

## 3. Stakeholders & Personas

| Stakeholder | Role in project |
| :-- | :-- |
| Griswold Hospitality (business owner) | Approves requirements; operates the portal as admin |
| Hotel clients (end users) | Consume reports and performance data for their properties |
| Development team | Builds the Strapi backend and Next.js frontend |
| Design team | Maintains the Figma design system feeding the frontend |

### 3.1 Persona — "Dana", Portal Administrator (internal)
- **Context:** Works at Griswold; manages all client relationships and audit deliverables.
- **Goals:** Onboard a client and grant access in seconds; publish a new report and have it appear immediately; revoke access instantly when an engagement ends.
- **Pain points to avoid:** Anything requiring a developer; multi-step permission configuration; email/verification flows.
- **Primary surface:** Strapi admin panel only. Dana never uses the client portal.

### 3.2 Persona — "Sam", Hotel Client (external)
- **Context:** Operations or ownership contact at a hotel property (or an enterprise group overseeing many properties).
- **Goals:** Log in with simple credentials; quickly find the latest audit score and report for each property; download the PDF or open the full interactive report.
- **Pain points to avoid:** Account setup friction; seeing data that isn't theirs; needing IT to get in.
- **Primary surface:** The client portal. Sam never sees Strapi.
- **Note:** A single login may be shared by several people at one property (intentional — see §13).

---

## 4. System Overview

The portal comprises four connected layers. **Strapi and the frontend are separate applications**: the frontend holds no data; it requests scoped data from Strapi's API at runtime and renders it.

| Layer | Technology | Responsibility |
| :-- | :-- | :-- |
| Content & Data | Strapi Cloud | Stores properties, reports, users, and media. Exposes a guarded REST API. **Enforces who-sees-what.** |
| Frontend | Next.js (App Router, React) | Authenticates against Strapi, fetches scoped data server-side, renders the portal. |
| Source Control | GitHub | Single source of truth for the frontend codebase. |
| Hosting | Vercel | Auto-deploys the frontend on every push to the production branch; provides per-PR preview URLs. |
| Design | Figma | Holds the design system and templates; feeds the frontend via the design-to-code workflow (Technical Spec §7). **Builder.io is not used.** |

Content changes made in Strapi (a new report, a new user, an edited property) appear on the portal with **no code deployment**, because the frontend fetches live data on each request.

---

## 5. User Roles & Permissions

| Capability | Admin (Strapi) | Client (`client` role) |
| :-- | :-- | :-- |
| Access Strapi admin panel | Yes | No |
| Access client portal | No | Yes |
| Create / edit / delete users | Yes | No |
| Assign properties to users | Yes | No |
| Create / edit / publish reports | Yes | No |
| Edit property data & media | Yes | No |
| View assigned properties & reports | n/a | Yes (read-only) |
| View *unassigned* properties | n/a | **No (server-enforced)** |

There is exactly **one** client-facing role, `client`. It is granted read-only (`find`, `findOne`) access to Property, Reports BDTMSD, and Reports GH — and nothing else. All access scoping (limiting results to the user's own properties) is enforced by server-side controllers, not by the role permissions alone.

---

## 6. Functional Requirements

Requirements are grouped by area and individually identified. "The system" means the portal as a whole (Strapi + frontend) unless stated.

### 6.1 Authentication & Session (FR-1)
- **FR-1.1** The system shall provide a single login form accepting a username **or** email in one field (labeled "Username") plus a password.
- **FR-1.2** The system shall authenticate credentials against Strapi's local auth endpoint and establish a session on success.
- **FR-1.3** On successful login, the system shall redirect the user to the My Properties page.
- **FR-1.4** On failed login, the system shall display an inline error and shall not offer any account-recovery option.
- **FR-1.5** The system shall reject login for any account whose `confirmed` flag is false or whose `blocked` flag is true.
- **FR-1.6** The session shall persist for a configured lifetime (default 7 days) and shall be terminable by an explicit logout.
- **FR-1.7** The authentication token shall be stored such that client-side JavaScript cannot read it (httpOnly cookie).
- **FR-1.8** The system shall not provide any self-service registration or password-reset flow.

### 6.2 Authorization & Access Scoping (FR-2)
- **FR-2.1** A client shall be able to retrieve only properties assigned to their account, regardless of any request parameters they supply.
- **FR-2.2** A request for a property not assigned to the client shall return a not-found result (no data, no confirmation the property exists).
- **FR-2.3** Direct queries to either report collection shall return only reports belonging to the client's assigned properties.
- **FR-2.4** Access scoping shall be enforced server-side; frontend checks are treated as a usability convenience only.
- **FR-2.5** Setting a user's `blocked` flag shall revoke access on the next request without deleting the account.

### 6.3 My Properties (FR-3)
- **FR-3.1** The system shall display, to the logged-in client, all and only the properties assigned to them.
- **FR-3.2** Properties shall be displayed as cards showing hero image, name, location, latest performance score, and latest report date.
- **FR-3.3** Cards shall be ordered by the property's `order` field, ascending.
- **FR-3.4** The first/featured property may be rendered with greater visual emphasis.
- **FR-3.5** "Latest" score and date shall be derived from the most recent report by `date` across both report types for that property; the overall `performance_score` shall be shown.
- **FR-3.6** Clicking a card shall navigate to that property's detail page.
- **FR-3.7** A client with no assigned properties shall see an appropriate empty state.

### 6.4 Property Detail (FR-4)
- **FR-4.1** The system shall display all audit reports and performance content for a single assigned property.
- **FR-4.2** The page shall present four tabs: Reports, Hotel Performance, F&B Performance, Spa Performance.
- **FR-4.3** The Reports tab shall list reports of both types with type/label, score (incl. spa score for GH reports), date, a "View Report" action, and a "Download" action.
- **FR-4.4** "View Report" shall open the report's `full_report` URL in a new browser tab.
- **FR-4.5** "Download" shall deliver the report's PDF.
- **FR-4.6** The Reports tab shall provide a year filter (All / individual years) and a report-name search, applied to the loaded report list.
- **FR-4.7** Each Performance tab shall render its corresponding property field (`hotel_performance`, `fb_performance`, `spa_performance`).
- **FR-4.8** The page shall provide back-navigation to My Properties.
- **FR-4.9** Direct navigation to an unassigned property's URL shall yield a not-found state, not data.

### 6.5 Content Management (FR-5, admin-facing)
- **FR-5.1** An admin shall be able to create a client user with username, placeholder email, password, `confirmed = true`, and one or more assigned properties.
- **FR-5.2** An admin shall be able to reset a user's password by setting a new value (existing passwords cannot be retrieved — see §16).
- **FR-5.3** An admin shall be able to revoke access via the `blocked` flag, by removing property assignments, or by deleting the account.
- **FR-5.4** An admin shall be able to create and publish reports of both types, attach a PDF, set scores and date, and link them to properties.
- **FR-5.5** Published content changes shall appear on the portal without a code deployment.

---

## 7. Data Model & Content Types

Five content types, linked by relations. The authoritative schema (field types, relation ownership, constraints) is shipped as Strapi schema files and detailed in the Technical Spec §3.1. This section is the business-level data dictionary.

### 7.1 Entity relationships (summary)
- A **Property** belongs to one **Location**; a Location has many Properties.
- A **Property** is linked to many **Users**, and a **User** to many Properties (many-to-many). This relation *is* the access-control model.
- A **Property** is linked to many **Reports BDTMSD** and many **Reports GH** (each many-to-many).

```
Location 1───* Property *───* User
                  │   │
                  │   └────* Reports GH
                  └────────* Reports BDTMSD
```

### 7.2 User (Strapi built-in, extended)

| Field | Type | Required | Constraints / Notes |
| :-- | :-- | :-- | :-- |
| `username` | Text | Yes | Unique. The login ID (e.g., `fourseasonsmaui`). |
| `email` | Email | Yes (system) | Unique. Placeholder accepted; never contacted. **Each account needs a *distinct* placeholder** (e.g., `prop-slug@noreply.griswoldhospitality.com`) — a duplicate fails Strapi's unique constraint. |
| `password` | Password | Yes | Hashed (bcrypt); **not viewable after saving** (§16). |
| `properties` | Relation → Property (M:N) | Yes | Defines which properties the user can access. |
| `full_name` | Text | No | Internal tracking only; never shown to clients. *Added in this version.* |
| `confirmed` | Boolean | Yes | Must be `true` to permit login. |
| `blocked` | Boolean | No | `true` = access revoked (kill switch). Default `false`. |
| `role` | Relation → Role | Yes | All clients assigned the single `client` role. |

### 7.3 Property (central content type)

| Field | Type | Required | Constraints / Notes |
| :-- | :-- | :-- | :-- |
| `name` | Text | Yes | e.g., "Four Seasons Hualalai". |
| `property_type` | Enumeration | No | Property category (resort, city hotel, boutique, spa resort, residence, other). |
| `image` | Media (multiple, images) | No | Hero image(s) for the card and detail page. |
| `location` | Relation → Location (M:1) | No | One location per property. |
| `reports_bdtmsds` | Relation → Reports BDTMSD (M:N) | No | BDT&MSD reports for this property. |
| `reports_ghs` | Relation → Reports GH (M:N) | No | GH reports for this property. |
| `users` | Relation → User (M:N) | No | Which users can access this property. |
| `hotel_performance` | Text (long string) | No | **Redesign convention (superseded DD-10 — see note below):** holds a Looker Studio **embed URL**, rendered as a guarded iframe on the Hotel Performance tab. Non-conforming values degrade to no embed. |
| `spa_performance` | Text (long string) | No | Same convention as `hotel_performance`, for the Spa Performance tab. |
| `fb_performance` | Text (long string) | No | Same convention as `hotel_performance`, for the F&B Performance tab. |
| `property_info` | Text (long string) | No | **Redesign convention:** holds a URL to an external property-info document (e.g., a view-only Google Doc link), rendered as a "?" help link on the detail page — not a plain description. |
| `order` | Integer | No | Display order on My Properties (ascending). Default `0`. |

> **Redesign note (supersedes the "plain string" framing below and in DD-10).** The schema type for these four fields is still plain `text` — Strapi does not enforce a URL format — but the **content convention**, fixed by the Frontend Redesign initiative, is that editors populate them with URLs (a `lookerstudio.google.com` embed URL for the three performance fields; any `http(s)` doc link for `property_info`), and the frontend renders them accordingly (guarded iframe / help link, not raw text). See `04-Admin-Runbook.md` (content table) and Technical Spec §4.11. A value that isn't a conforming URL is never embedded or linked — it degrades to an empty/no-op state rather than rendering as text.

### 7.4 Reports BDTMSD

| Field | Type | Required | Constraints / Notes |
| :-- | :-- | :-- | :-- |
| `properties` | Relation → Property (M:N) | No | Properties this report belongs to. |
| `type` | Text | No | Report label (e.g., "Q4 2025 Luxury Audit Report"). |
| `performance_score` | Decimal | No | Overall score (e.g., 87.26). |
| `download` | Media (single file) | No | Downloadable PDF. |
| `full_report` | Text | No | URL to the full interactive report. |
| `date` | Date | No | Audit / publication date. |

### 7.5 Reports GH
Identical to Reports BDTMSD **plus** `spa_score` (Decimal) — a separate spa performance score unique to GH reports. `type` is included on this type as well, for label consistency on the Reports tab. (The source PRD omitted `type` from the GH table while stating GH is "the same structure plus `spa_score`"; it is included here. See §16.)

### 7.6 Location

| Field | Type | Required | Constraints / Notes |
| :-- | :-- | :-- | :-- |
| `name` | Text | Yes | e.g., "Kailua-Kona, Hawaii". |
| `properties` | Relation → Property (1:M) | No | All properties at this location. |

---

## 8. Page Architecture & User Flows

Three page types, each fetching scoped data based on the session.

### 8.1 Login — route `/`
**Purpose:** authenticate and start a session.
**UI:** Username field (accepts username or email), Password field, Log In button, portal branding. No "forgot password" link.

**Flow — successful login**
1. Sam opens `client.griswoldhospitality.com`.
2. Sam enters username and password and submits.
3. The system authenticates against Strapi; Strapi returns a token.
4. The system stores the token as an httpOnly cookie and redirects to `/properties`.

**Flow — failed login**
1. Sam submits bad credentials (or a blocked/unconfirmed account).
2. The system shows an inline error.
3. No recovery option is offered; Sam contacts the admin out-of-band.

### 8.2 My Properties — route `/properties`
**Purpose:** show every property the client can access.
**UI:** a grid of property cards (hero image, name, location, latest score, latest date), ordered by `order`. Enterprise clients with many properties see a full grid; the featured/first card may be larger.

**Flow**
1. The system reads the authenticated session.
2. The system requests the client's properties from the guarded properties endpoint (server-scoped to this user).
3. For each property, the system computes the latest score/date from its reports.
4. Cards render in `order`. Clicking one navigates to its detail page.
5. If the client has no properties, an empty state is shown.

### 8.3 Property Detail — route `/properties/[id]`
**Purpose:** all reports and performance data for one property.
**UI:** four tabs (Reports / Hotel / F&B / Spa); the Reports tab lists reports with score, date, View Report, Download, plus year filter and name search; a back control returns to My Properties.

**Flow**
1. The system requests the property by id from the guarded endpoint.
2. If the property is not assigned to the client, the server returns not-found and the page shows a friendly not-found state (URL-guessing yields nothing).
3. Otherwise the page renders the tabs from the property's fields and linked reports.
4. View Report opens `full_report` in a new tab; Download serves the PDF; filters narrow the list client-side.

---

## 9. Administrative Workflows

(Full step-by-step is in `03-Technical-Spec.md`; summarized here for the product picture.)

- **Create a client user** (target under 60s): set username, placeholder email, password, `confirmed = true`, assign properties, optionally `full_name`, Save, then share credentials out-of-band.
- **Reset a password:** set a new password value and Save (the existing one cannot be retrieved — §16), then communicate it.
- **Revoke access:** set `blocked = true` (temporary), remove a property from the user's assignments (scope down), or delete the user (permanent).
- **Add a report:** create a Reports BDTMSD or Reports GH entry, fill `type`/`date`/scores, upload the PDF, paste the `full_report` URL, link to the property, Save & Publish.

---

## 10. Non-Functional Requirements

| ID | Category | Requirement |
| :-- | :-- | :-- |
| NFR-1 | Security | Access scoping enforced server-side; tokens in httpOnly cookies; confidential media not reachable without an ownership check (Technical Spec §3.8); single least-privilege client role. |
| NFR-2 | Privacy | No real client email required or contacted; shared accounts supported; no client activity surfaced to other clients. |
| NFR-3 | Performance | My Properties and Detail pages should render within ~2s on a typical broadband connection with a representative data set; server-side fetching avoids large client bundles. |
| NFR-4 | Availability | Hosting on managed platforms (Strapi Cloud, Vercel); no custom infrastructure to maintain. |
| NFR-5 | Accessibility | Target WCAG 2.1 AA for the client-facing pages: keyboard navigability, sufficient contrast, labeled form fields, focus states, alt text on images. |
| NFR-6 | Browser support | Current stable Chrome, Safari, Firefox, and Edge; responsive across mobile, tablet, and desktop. |
| NFR-7 | Maintainability | Reusable component library; design tokens shared between Figma and code; backend content types shipped as version-controlled schema files. |
| NFR-8 | Operability | Content changes require no deployment; account and report management require no developer. |
| NFR-9 | Observability | Errors surfaced via Vercel and Strapi Cloud logging; auth failures distinguishable from authorization failures (Technical Spec §10). |

---

## 11. Authentication & Security (Summary)

Full detail in Technical Spec §3.3–§3.8. Essentials:

- **Auth:** Strapi JWT issued on successful local login.
- **Token storage:** httpOnly cookie set by the frontend (a deliberate hardening over the source PRD's "localStorage or cookie", given the data is confidential).
- **Session length:** 7 days (configurable). See the hardening note below.
- **Enforcement:** server-side scoped controllers in Strapi are the security boundary; the frontend guard is convenience only. *(This corrects the source PRD, which framed the property guard as a frontend responsibility — see §16.)* Scoping covers both filtering **and** population (the controllers force a server-side populate allow-list so related accounts can't be read through populate).
- **Kill switch:** `blocked = true` is enforced on every authenticated request (Strapi re-checks the user from the database), so it revokes an already-issued token on the user's next request — a genuine immediate kill switch, not just a login-time check.
- **Token caveat:** a *leaked* token stays valid until it expires (plain logout doesn't invalidate it server-side). For this reason a shorter session (≤ 1 day) with a refresh flow is recommended for confidential data; if the 7-day session is kept it is a documented accepted risk (DD-9), compensated by the per-request `blocked` check, rate limiting, and audit logging.
- **Patched versions required:** Strapi ≥ 5.37.0 and Next.js ≥ 15.2.3 (Technical Spec §2.1).
- **Shared accounts:** supported by design.

---

## 12. Assumptions, Dependencies & Constraints

**Assumptions**
- A1 — The volume of clients, properties, and reports is modest (tens–hundreds), well within Strapi Cloud and Vercel comfortable limits.
- A2 — Admins are trusted and trained; account hygiene (password strength, sharing) is an operational responsibility.
- A3 — `full_report` links point to externally hosted interactive reports whose own access control is out of scope (see §16 / Technical Spec §3.8).

**Dependencies**
- D1 — Active Strapi Cloud and Vercel accounts/projects.
- D2 — A GitHub repository for the frontend.
- D3 — A Figma plan supporting Dev Mode and Code Connect for the design-to-code workflow (Technical Spec §7) — to be confirmed with the client.
- D4 — DNS control for `client.griswoldhospitality.com`.

**Constraints**
- C1 — No automated email of any kind (no SendGrid/Mailgun/SMTP).
- C2 — No self-service registration or password reset.
- C3 — A single client role; no granular per-field permissions in v1.

---

## 13. Confirmed Decisions (Decision Log)

| # | Decision | Rationale |
| :-- | :-- | :-- |
| DD-1 | No self-registration; admin creates all accounts | Admin-centric philosophy; low overhead |
| DD-2 | No client-side forgot-password; admin resets manually | Avoids email infrastructure |
| DD-3 | Placeholder emails accepted for shared accounts | Satisfies Strapi's required unique email without real addresses |
| DD-4 | A single `client` role for all portal users | Simplicity |
| DD-5 | Account sharing permitted | A property's team can use one login |
| DD-6 | `blocked` is the kill switch; deletion optional | Instant revoke without data loss |
| DD-7 | Login labeled "Username" but accepts username or email | Strapi `identifier` supports both natively |
| DD-8 | `full_name` added now | Useful internal tracking; trivial to add |
| DD-9 | Token expiry = 7 days | Balances convenience and exposure. **Flagged for reconsideration:** OWASP guidance favors much shorter sessions for confidential data; ≤ 1 day + refresh is recommended (Technical Spec §3.5, Risk R10). Kept at 7 days only if accepted as a documented risk. |
| DD-10 | Performance fields are plain strings | Formatting comes from frontend styling. **Superseded by the Frontend Redesign initiative:** the three performance fields and `property_info` remain `text` at the schema level, but the shipped UI treats their *content* as URLs — Looker Studio embed URLs rendered as guarded iframes, and a doc URL rendered as a help link — not as freeform prose. §7.3 reflects this. |
| DD-11 | "View Report" opens `full_report` in a new tab | Keeps the portal context |
| DD-12 | Strapi content types delivered as schema files | Reproducible, version-controlled backend |
| DD-13 | Builder.io removed; use Figma → Next.js → Vercel workflow | Simpler, no extra tool |
| DD-14 | Token stored in httpOnly cookie, not localStorage | Hardening for confidential data |
| DD-15 | My Properties reads guarded `/api/properties`, not `users/me` | Robust + secure (see §16) |

---

## 14. Success Metrics & KPIs

| Metric | Target |
| :-- | :-- |
| Time to create a user and assign a property | < 60 seconds |
| Automated email triggers configured | 0 |
| Cross-client data leakage (verified by test) | 0 incidents |
| Content change to live (report/property edit) | No deployment required |
| Time to revoke access via `blocked` | Immediate (next request) |
| Client-facing pages meeting accessibility target | WCAG 2.1 AA |

---

## 15. Risks (Summary)

Top risks (with mitigations):

- **Access scoping implemented only in the frontend** → data leak. Mitigated by server-side controllers (FR-2) made a release blocker.
- **Confidential PDFs served from public media URLs** → report leak. Mitigated by a proxy-download decision (Technical Spec §3.8).
- **External `full_report` links lacking access control** → report visible to anyone with the link. Mitigated by confirming upstream access control or gating the link.

---

## 16. Corrections to Source Documents

Three items from the source documents are addressed here and throughout the deliverables:

1. **"Admin can unmask / look up the existing password and tell the client."** Not possible. Strapi stores passwords hashed (bcrypt); they are never recoverable or viewable after saving. The only reset path is to set a new password and Save (see §9, FR-5.2).
2. **`GET /api/users/me?populate=properties...` as the My Properties source.** Strapi's `users/me` endpoint does not reliably honor deep/nested `populate`. The portal instead reads the My Properties list from the **guarded `GET /api/properties`** endpoint, which is automatically scoped to the user and supports the needed populate (DD-15; Technical Spec §3.3, §4.7).
3. **Property guard described as a frontend responsibility.** Treated here as convenience only; the real boundary is server-side (FR-2.4; Technical Spec §3.3). Additionally, the GH report `type` field is included for label consistency (§7.5).

**Post-validation hardening.** An independent technical review of this plan confirmed the architecture is sound and added the following hardening, now reflected throughout: (a) the controllers constrain **populate** server-side, not just filtering, to close a relation-population leak path; (b) the `client` role also gets read access to **Location** (scoped) so location names display; (c) **minimum patched versions** are pinned (Strapi ≥ 5.37.0, Next.js ≥ 15.2.3); (d) the **JWT lifetime** is flagged for reduction (DD-9); and (e) the `blocked` kill switch is confirmed to act on every request, not only at login.

---

## 17. Out of Scope & Future Considerations

**Out of scope (v1)**
- Self-service registration or client-side password reset
- Any automated/transactional email
- Multiple admin roles or granular per-field permissions
- In-portal report authoring/editing by clients
- Rich-text performance content (plain strings only)
- Analytics/BI dashboards beyond the performance tabs
- Localization / multi-language
- Native mobile apps (responsive web only)
- SSO / social login
- Per-user activity audit logging

**Candidate future phases**
- Proxy/signed-URL secure media delivery (may be pulled into v1 — Technical Spec §3.8)
- Optional refresh-token rotation / shorter sessions
- Per-property report notifications (would require email — currently excluded)
- Richer performance content (rich text / charts)
- Per-person accounts with activity logging (would change the shared-account model)

---

## 18. Appendix A — Glossary

| Term | Meaning |
| :-- | :-- |
| **Admin** | Internal Griswold user who manages everything in Strapi; never uses the portal. |
| **Client / Client user** | External hotel user who logs into the portal; read-only; sees only assigned properties. |
| **Property** | A hotel property; the central content type all other content connects to. |
| **Report (BDTMSD / GH)** | An audit report; two types, GH adds a separate spa score. |
| **Location** | A geographic grouping that a property belongs to. |
| **`order`** | Integer controlling display order on My Properties. |
| **`confirmed` / `blocked`** | Strapi user flags gating login and revoking access. |
| **JWT** | JSON Web Token; the credential issued by Strapi on login. |
| **httpOnly cookie** | A cookie unreadable by client JavaScript; where the token is stored. |
| **`documentId`** | Strapi 5's stable 24-char record identifier used in API URLs. |
| **Scoping / guard** | Server-side restriction of results to the user's own properties. |
| **Strapi Cloud / Vercel** | Managed hosting for the CMS/API and the frontend, respectively. |
| **Code Connect / Dev Mode MCP** | Figma features linking design components to code for the design-to-code workflow. |
