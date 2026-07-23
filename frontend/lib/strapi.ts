import { getToken } from './session';
import { getStrapiUrl } from './env';

// Server-side Strapi fetch helper. Attaches the JWT from the httpOnly cookie as
// a Bearer token. The raw token and the Strapi origin never reach the client
// bundle, because STRAPI_URL has no NEXT_PUBLIC_ prefix and this runs on the
// server. `cache: 'no-store'` makes published Strapi content appear without a
// redeploy (FR-5.5 / AC-21).
export async function strapiFetch(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${getStrapiUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  return res;
}
