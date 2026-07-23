import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/env';

// POST: clear the session cookie (FR-1.6 / AC-10). Note: this clears the cookie
// in the browser but does not invalidate the JWT server-side — see the leaked-
// token caveat in Technical Spec §3.5.
export async function POST() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
  return Response.json({ ok: true });
}
