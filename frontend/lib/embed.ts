// URL guards for admin-editable fields.

// http(s)-only guard for link fields (e.g. property_info). Rejects
// javascript:/data:/other schemes that would execute or render on click (stored
// XSS). Mirrors the private guard in lib/reports.ts; kept here so the
// page/components can reuse it without changing the data layer.
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const { protocol } = new URL(value.trim());
    return protocol === 'https:' || protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

// Looker Studio embed guard (FR-4.7 / Framework §6.1). The performance fields are
// free text by editorial convention holding Looker embed URLs; only embed a
// value as an iframe src when it is exactly an https URL on
// lookerstudio.google.com. Any other origin or non-URL returns null and must NOT
// be embedded — this prevents an admin-entered field from framing an arbitrary
// origin even under the relaxed frame-src CSP.
export function lookerEmbedSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' && u.hostname === 'lookerstudio.google.com'
      ? u.toString()
      : null;
  } catch {
    return null;
  }
}
