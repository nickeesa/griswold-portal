module.exports = ({ env }) => ({
  'users-permissions': {
    config: {
      jwt: {
        // Client session length. PRD default: 7 days. For confidential data,
        // OWASP favours a shorter window — set JWT_EXPIRES_IN=1d (or less) to
        // tighten without a code change. MUST be kept in lockstep with the cookie
        // maxAge in the frontend /api/login handler (SESSION_MAX_AGE_SECONDS).
        expiresIn: env('JWT_EXPIRES_IN', '7d'),
      },
      // Auth-endpoint rate limit (brute-force mitigation — MVP Risk R8).
      // Production keeps the strict default (10 requests / 60s). In dev/test the
      // access-control suite performs many rapid logins, which would otherwise
      // trip a 429; it is therefore disabled outside production.
      // NEVER disable this in production.
      ratelimit:
        env('NODE_ENV') === 'production'
          ? { interval: 60000, max: 10 }
          : { enabled: false },
    },
  },
});
