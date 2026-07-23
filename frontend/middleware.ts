import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/env';

// UX redirect ONLY — checks cookie presence so logged-out users don't see a
// flash of a protected page. This is NOT the security boundary: real
// authorization happens server-side on every Strapi call (the scoped
// controllers + strapiFetch), so a stale or forged cookie still yields no data.
// See Technical Spec §4.5 and CVE-2025-29927 (patched in Next.js >= 15.2.3).
export function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (req.nextUrl.pathname.startsWith('/properties') && !token) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/properties/:path*'] };
