import { strapiFetch } from '@/lib/strapi';
import { getStrapiUrl } from '@/lib/env';
import {
  extensionFromFileUrl,
  isAllowedSecFetchSite,
  mapOwnershipStatus,
  resolveStrapiMediaUrl,
  sanitizeDownloadBasename,
} from '@/lib/download-proxy.mjs';
import type { StrapiProperty, StrapiReport } from '@/lib/types';

// Authenticated proxy download (F10). Re-checks ownership server-side via the
// guarded findOne, then streams the file. The raw Strapi media URL is never
// exposed to the client; a client cannot download another client's PDF even
// with the report id. (Technical Spec §3.8 / §4.10.)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> },
) {
  // CSRF defense-in-depth: refuse cross-site requests. Same-origin/same-site
  // requests and direct user navigations (`none`) are allowed; browsers that
  // don't send the header (and non-browser callers) fall through unchanged.
  const site = req.headers.get('sec-fetch-site');
  if (!isAllowedSecFetchSite(site)) {
    return new Response('Forbidden', { status: 403 });
  }

  const { id, reportId } = await params;

  // 1) Confirm the property is assigned to this user (guarded findOne → 404 if not).
  //    The controller's DETAIL_POPULATE already includes the report download files.
  const propRes = await strapiFetch(`/api/properties/${id}`);
  const mapped = mapOwnershipStatus(propRes.status);
  if (mapped === 404) return new Response('Not found', { status: 404 });
  if (mapped === 401 || mapped === 403) {
    return new Response('Unauthorized', { status: mapped });
  }
  if (mapped === 500) return new Response('Error', { status: 500 });

  const { data: property } = (await propRes.json()) as { data: StrapiProperty };

  // 2) Find the report among this property's reports and read its file URL.
  const all: StrapiReport[] = [
    ...(property.reports_bdtmsds ?? []),
    ...(property.reports_ghs ?? []),
  ];
  const report = all.find((r) => r.documentId === reportId);
  const fileUrl = report?.download?.url;
  if (!report || !fileUrl) return new Response('Not found', { status: 404 });

  const safeName = sanitizeDownloadBasename(report.type);
  const ext = extensionFromFileUrl(fileUrl);

  // Resolve to an absolute URL, but only ever fetch back from the configured
  // Strapi origin. A relative `/uploads/...` path is prefixed; an absolute URL is
  // accepted only if it points at the Strapi origin — never an arbitrary host
  // (removes a latent SSRF path should an upload provider ever store an
  // off-origin URL). If you switch to an external media provider (S3/Cloudinary),
  // widen this check to that provider's origin.
  const absolute = resolveStrapiMediaUrl(fileUrl, getStrapiUrl());
  if (!absolute) return new Response('Not found', { status: 404 });

  const fileRes = await fetch(absolute, { cache: 'no-store' });
  if (!fileRes.ok || !fileRes.body) return new Response('Not found', { status: 404 });

  return new Response(fileRes.body, {
    status: 200,
    headers: {
      'Content-Type': fileRes.headers.get('Content-Type') ?? 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}${ext}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
