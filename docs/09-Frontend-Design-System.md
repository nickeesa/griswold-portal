# 09 — Frontend Design System

Records the visual system applied to `frontend/` so future changes stay consistent. A light "luxury hotel" theme implemented with Tailwind CSS v3 + a minimal shadcn/ui set, layered over the unchanged server-rendered, ownership-scoped data layer (skin, not spine).

---

## Stack
- Next.js 15 App Router, React 19, TypeScript (strict).
- **Tailwind CSS v3** (`frontend/tailwind.config.ts`, `frontend/postcss.config.mjs`) — pinned to v3 to match this token/config model (not v4).
- **shadcn/ui** primitives in `frontend/components/ui/` — only the parts in use: `button`, `input`, `label`, `alert`, `badge`, `dropdown-menu`, `tooltip`.
- `lucide-react` icons; `cn()` (`clsx` + `tailwind-merge`) in `frontend/lib/utils.ts`.

## Theme tokens
Defined in `frontend/app/globals.css` `@layer base :root` (light only — no `.dark`) and mapped in `tailwind.config.ts`:
- **Brand:** `hotel-green` `#38761d` (hover `#2d5e16`) for primary actions/active states; `hotel-blue`, `hotel-gray` accents.
- **shadcn HSL variables:** `background/foreground/card/popover/primary/secondary/muted/accent/destructive/border/input/ring`; `--radius: 0.5rem`.
- **Fonts:** system-ui stack (no web-font dependency).

## Architecture: skin, not spine
- Pages are **Server Components** that `await strapiFetch(...)` and stay `ƒ (Dynamic)`: `app/page.tsx`, `app/properties/page.tsx`, `app/properties/[id]/page.tsx`.
- shadcn lives only in **client leaves**: `LoginForm`, `TabBar`, `ReportsTab`, `UserMenu` (+ `components/ui/*`).
- Data/auth modules are unchanged: `lib/strapi.ts`, `lib/session.ts`, `lib/env.ts`, `lib/reports.ts`, `middleware.ts`, `app/api/**`.

## Screen patterns
- **Login** (`/`): full-height split — hero (`public/login-hero.jpg`, self-hosted placeholder) with dark gradient + uppercase branding; white shadcn login card.
- **My Properties** (`/properties`): white header bar (brand + `UserMenu`); featured first card (≈21:9) + responsive 3-column grid (≈4:3); image + dark gradient overlay, hover zoom.
- **Property Detail** (`/properties/[id]`): header with back link + name/location + `UserMenu`; tab bar — Reports always, performance tabs only when their field has content; `property_info` "?" tooltip link when present.
- **Reports tab**: bordered cards, source `Badge`, color-coded Property Score, year-filter buttons + search, View Report (new tab) + Download (proxy).

## Helpers
- `lib/score.ts` `scoreColor()` — Property Score scale: ≥90 green `#34a853`, ≥85 olive `#a4b164`, ≥77 orange `#e69138`, else red `#ea4335`; non-numeric grey `#6b7280`.
- `lib/embed.ts` — `lookerEmbedSrc()` (embed gate: https + `lookerstudio.google.com`) and `safeHttpUrl()` (http(s)-only link guard for `property_info`).

## Security-relevant UI rules (do not regress)
- Performance fields embed as an iframe **only** via `lookerEmbedSrc`; the CSP allows `frame-src https://lookerstudio.google.com` and nothing else new (see `frontend/README.md` and `next.config.mjs`).
- Report downloads use the proxy `downloadHref` only — never a raw Strapi media URL.
- No `NEXT_PUBLIC_` Strapi URL/token; pages stay server-rendered.

## Accessibility
Global `:focus-visible` ring; `prefers-reduced-motion` block; `.sr-only`; ARIA tablist keyboard pattern on the detail tabs (arrows/Home/End, roving tabindex) over the visible tabs; alt text on images.
