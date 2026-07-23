import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, getStrapiUrl, getSessionMaxAgeSeconds } from '@/lib/env';
import { checkLoginRateLimit, clientIpFromRequest } from '@/lib/rate-limit';

// POST: authenticate against Strapi local auth and set the JWT as an httpOnly
// cookie. The token is never exposed to client-side JS (FR-1.7 / AC-5).
export async function POST(req: Request) {
  let identifier: string, password: string;
  try {
    ({ identifier, password } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!identifier || !password) {
    return Response.json(
      { error: 'Username and password are required.' },
      { status: 400 },
    );
  }

  // Per-client-IP + identifier limiter (see lib/rate-limit.ts). Uses
  // x-forwarded-for when present (Vercel / reverse proxies).
  const ip = clientIpFromRequest(req);
  const limited = checkLoginRateLimit(`${ip}|${String(identifier).toLowerCase()}`);
  if (!limited.ok) {
    return Response.json(
      { error: 'Too many login attempts. Please try again shortly.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limited.retryAfterSec) },
      },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${getStrapiUrl()}/api/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `identifier` accepts username OR email natively (FR-1.1, AC-6/AC-7).
      body: JSON.stringify({ identifier, password }),
      cache: 'no-store',
    });
  } catch {
    return Response.json(
      { error: 'Login service unavailable. Please try again.' },
      { status: 503 },
    );
  }

  if (!res.ok) {
    // Strapi returns 400 for bad creds / blocked / unconfirmed. Keep the client
    // message generic — don't reveal which accounts exist (FR-1.4 / AC-8/AC-9).
    // Pass through 429 from Strapi when its own limiter fires.
    if (res.status === 429) {
      return Response.json(
        { error: 'Too many login attempts. Please try again shortly.' },
        { status: 429 },
      );
    }
    return Response.json(
      { error: 'Invalid username or password.' },
      { status: 401 },
    );
  }

  const { jwt } = await res.json();
  (await cookies()).set(SESSION_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    // MUST match the Strapi JWT expiresIn (§3.5) — set SESSION_MAX_AGE_SECONDS and
    // JWT_EXPIRES_IN together. Defaults to 7 days.
    maxAge: getSessionMaxAgeSeconds(),
  });

  return Response.json({ ok: true });
}
