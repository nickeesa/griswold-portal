# Griswold Hospitality — Client Portal (Frontend)

Server-rendered Next.js 15 (App Router) client portal. Hotel clients log in and see only the properties assigned to them, with read-only audit reports and embedded performance dashboards. Auth is a server-side httpOnly JWT cookie; **all Strapi calls happen server-side**.

## Stack
- Next.js 15 + React 19 + TypeScript (strict).
- Tailwind CSS v3 + a minimal shadcn/ui set (`button`, `input`, `label`, `alert`, `badge`, `dropdown-menu`, `tooltip`) + `lucide-react`. See [`../docs/09-Frontend-Design-System.md`](../docs/09-Frontend-Design-System.md).

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

## Environment (`.env.local`, server-only)
Copy `.env.example`. There are **no `NEXT_PUBLIC_` Strapi values** — the Strapi origin and JWT must never reach the client bundle.
- `STRAPI_URL` — backend origin (e.g. `https://<app>.strapiapp.com`).
- `SESSION_COOKIE_NAME` — default `gh_token`.
- `SESSION_MAX_AGE_SECONDS` — keep in lockstep with the Strapi `JWT_EXPIRES_IN`.

## Security headers / CSP
Security headers are set in `next.config.mjs`. The redesign added exactly **one** CSP change: `frame-src https://lookerstudio.google.com`, to embed client performance dashboards. The iframe `src` is **additionally host-guarded in code** (`lib/embed.ts` → `lookerEmbedSrc`), so a misconfigured field can never frame an arbitrary origin. `img-src` already allows `https:` (which covers the Strapi media host), so it was left unchanged. All other directives (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, HSTS, `X-Content-Type-Options`, etc.) are unchanged.

## Backend connection (CORS)
The portal calls Strapi **server-side**, so browser CORS is not on the critical path. The backend (`griswold-strapi`) CORS is already scoped to `https://client.griswoldhospitality.com`, `http://localhost:3000` in dev, and this project's Vercel previews — confirm the Vercel project slug before launch (`griswold-strapi/config/middlewares.ts`). No backend change is part of this frontend work.

## Architecture (do not regress)
Pages are React Server Components that `await strapiFetch(...)` and must stay `ƒ (Dynamic)`; shadcn lives only in client leaf components (`LoginForm`, `TabBar`, `ReportsTab`, `UserMenu`). Do not introduce `NEXT_PUBLIC_` Strapi config or client-side Strapi calls. Report downloads go through `/api/properties/[id]/reports/[reportId]/download` only — never a raw Strapi media URL.
