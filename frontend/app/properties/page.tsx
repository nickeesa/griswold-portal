import { redirect } from 'next/navigation';
import { strapiFetch } from '@/lib/strapi';
import { latestReportSummary } from '@/lib/reports';
import PropertyGrid from '@/components/PropertyGrid';
import EmptyState from '@/components/EmptyState';
import UserMenu from '@/components/UserMenu';
import type { PropertyCardData, StrapiProperty } from '@/lib/types';

export const metadata = { title: 'My Properties — Griswold Hospitality' };

const PAGE_SIZE = 100;

type ListResponse = {
  data: StrapiProperty[];
  meta?: { pagination?: { page: number; pageCount: number; pageSize: number; total: number } };
};

/** Fetch every page of the caller's scoped properties (FR-3.1 — no silent 25-cap). */
async function fetchAllProperties(): Promise<
  { ok: true; data: StrapiProperty[] } | { ok: false; status: number }
> {
  const all: StrapiProperty[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const res = await strapiFetch(
      `/api/properties?sort=order:asc&pagination[page]=${page}&pagination[pageSize]=${PAGE_SIZE}`,
    );
    if (res.status === 401 || res.status === 403) return { ok: false, status: res.status };
    if (!res.ok) return { ok: false, status: res.status };
    const json = (await res.json()) as ListResponse;
    all.push(...(json.data ?? []));
    pageCount = json.meta?.pagination?.pageCount ?? 1;
    page += 1;
  } while (page <= pageCount);

  return { ok: true, data: all };
}

// My Properties (FR-3). Reads the GUARDED /api/properties (not users/me — see
// PRD §16, DD-15). Strapi returns only this user's properties (AC-1). The
// controller defines the populate allow-list server-side, so we only sort.
export default async function MyProperties() {
  const result = await fetchAllProperties();

  // Expired/invalid token → back to login (Technical Spec §4.12).
  if (!result.ok && (result.status === 401 || result.status === 403)) redirect('/');
  if (!result.ok) throw new Error('Failed to load properties');

  const data = result.data;

  return (
    <div className="min-h-screen bg-hotel-gray-light">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold uppercase tracking-wide text-hotel-green">
            Griswold Hospitality
          </span>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-wide text-foreground">MY PROPERTIES</h1>
          <p className="mt-2 text-muted-foreground">
            Select a property to view reports and performance data.
          </p>
        </div>

        {!data?.length ? (
          <EmptyState message="No properties are assigned to your account yet." />
        ) : (
          <PropertyGrid cards={data.map(toCard)} />
        )}
      </main>
    </div>
  );
}

function toCard(p: StrapiProperty): PropertyCardData {
  const { latestScore, latestDate } = latestReportSummary(
    p.reports_bdtmsds ?? [],
    p.reports_ghs ?? [],
  );
  return {
    id: p.documentId,
    name: p.name,
    location: p.location?.name ?? null,
    image: p.image?.[0]?.url ?? null,
    latestScore,
    latestDate,
    order: p.order ?? 0,
  };
}
