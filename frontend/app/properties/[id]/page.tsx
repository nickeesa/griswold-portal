import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { strapiFetch } from '@/lib/strapi';
import { toRows } from '@/lib/reports';
import { safeHttpUrl } from '@/lib/embed';
import TabBar from '@/components/TabBar';
import UserMenu from '@/components/UserMenu';
import type { StrapiProperty } from '@/lib/types';

// Load the property once per request. Wrapped in React `cache` so the call in
// generateMetadata and the call in the page component are de-duplicated into a
// single guarded findOne (no extra backend request), even though the fetch is
// no-store.
const loadProperty = cache(async (id: string) => {
  const res = await strapiFetch(`/api/properties/${id}`);
  if (res.status === 404) return { status: 404 as const, property: null };
  if (res.status === 401 || res.status === 403) return { status: res.status, property: null };
  if (!res.ok) throw new Error('Failed to load property');
  const { data } = (await res.json()) as { data: StrapiProperty };
  return { status: 200 as const, property: data };
});

// Resolve the access guard in generateMetadata. Next awaits metadata BEFORE it
// streams the page shell (incl. the loading.tsx fallback), so notFound()/redirect()
// here set the correct HTTP status (404 / 3xx) instead of a soft-404 (200 + a
// not-found body streamed after the shell). FR-4.9 / AC-18.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadProperty(id);
  if (r.status === 404) notFound(); // server enforced the guard → real 404
  if (r.status === 401 || r.status === 403) redirect('/');
  return { title: `${r.property?.name ?? 'Property'} — Griswold Hospitality` };
}

// Property detail (FR-4). Populate (incl. report download files) is enforced by
// the controller (DETAIL_POPULATE). The guarded findOne returns 404 for an
// unassigned property; the metadata guard above turns that into a real 404.
export default async function PropertyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await loadProperty(id);

  if (r.status === 404) notFound(); // belt-and-suspenders (metadata already guards)
  if (r.status === 401 || r.status === 403) redirect('/');
  if (!r.property) throw new Error('Failed to load property');
  const property = r.property;

  // Map reports to view rows HERE (server-side) so the raw Strapi media URL on
  // each report's `download` never gets serialized into the client RSC payload —
  // only the proxy `downloadHref` reaches the browser (§4.10).
  const rows = toRows(
    property.documentId,
    property.reports_bdtmsds ?? [],
    property.reports_ghs ?? [],
  );

  return (
    <div className="min-h-screen bg-hotel-gray-light">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <Link
              href="/properties"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              My Properties
            </Link>
            <h1 className="mt-1 truncate text-xl font-semibold text-foreground">
              {property.name}
            </h1>
            {property.location?.name ? (
              <p className="text-sm text-muted-foreground">{property.location.name}</p>
            ) : null}
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <TabBar
          key={property.documentId}
          rows={rows}
          hotelPerformance={property.hotel_performance ?? null}
          fbPerformance={property.fb_performance ?? null}
          spaPerformance={property.spa_performance ?? null}
          propertyInfoHref={safeHttpUrl(property.property_info)}
        />
      </main>
    </div>
  );
}
