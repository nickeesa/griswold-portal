/** @type {import('next').NextConfig} */

// In dev, Next's HMR needs eval and a websocket; relax just those two directives
// so local development isn't broken while production stays tight.
const isDev = process.env.NODE_ENV !== 'production';

// NOTE: script-src keeps 'unsafe-inline' because Next injects inline bootstrap/
// RSC-streaming scripts. Tightening to a nonce-based strict CSP requires
// generating a per-request nonce in middleware — tracked as a follow-up; this
// already adds clickjacking, sniffing, referrer, and transport protections.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Embedded client performance dashboards: scoped to the Google Looker Studio
  // embed family. The iframe src is still host-guarded in code
  // (lib/embed.ts → lookerEmbedSrc) to lookerstudio.google.com, so an admin-entered
  // field cannot frame an arbitrary origin; the extra Google origins here only
  // permit Looker's OWN in-iframe redirects when rendering a report (the legacy
  // datastudio domain, and accounts.google.com for viewer auth). frame-ancestors
  // stays 'none' (that controls who may embed US, not what we embed).
  'frame-src https://lookerstudio.google.com https://datastudio.google.com https://accounts.google.com',
  "img-src 'self' https: data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  `connect-src 'self'${isDev ? ' ws:' : ''}`,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
