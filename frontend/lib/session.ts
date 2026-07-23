import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from './env';

// Reads the JWT from the httpOnly session cookie (server-side only).
export async function getToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}
