import type { ReportRow, StrapiReport } from './types';
import { safeHttpUrl } from './embed';

// Merge both report types into a single sorted list of view rows (Reports tab).
// `downloadHref` points at the proxy route (§4.10), never the raw Strapi URL.
export function toRows(
  propertyId: string,
  bdtmsd: StrapiReport[] = [],
  gh: StrapiReport[] = [],
): ReportRow[] {
  const map = (r: StrapiReport, source: 'BDTMSD' | 'GH'): ReportRow => ({
    id: r.documentId,
    source,
    type: r.type ?? null,
    date: r.date ?? null,
    performanceScore: r.performance_score ?? null,
    spaScore: source === 'GH' ? (r.spa_score ?? null) : null,
    downloadHref: r.download
      ? `/api/properties/${propertyId}/reports/${r.documentId}/download`
      : null,
    fullReport: safeHttpUrl(r.full_report),
  });

  return [
    ...bdtmsd.map((r) => map(r, 'BDTMSD')),
    ...gh.map((r) => map(r, 'GH')),
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')); // newest first
}

// Distinct years for the year filter. Parse the year straight from the ISO date
// string — `new Date(date).getFullYear()` would read a UTC-midnight date in
// local time and shift Jan-1 reports into the previous year in UTC-negative
// time zones (Technical Spec §4.9, v2.1 fix).
export function distinctYears(rows: ReportRow[]): number[] {
  const years = new Set<number>();
  rows.forEach((r) => {
    if (r.date) years.add(Number(r.date.slice(0, 4)));
  });
  return [...years].sort((a, b) => b - a);
}

// Latest score/date for a My Properties card (FR-3.5): newest report by `date`
// across both types; shows the overall performance_score.
type AnyReport = { performance_score?: number | null; date?: string | null };

export function latestReportSummary(bdtmsd: AnyReport[] = [], gh: AnyReport[] = []) {
  const all = [...bdtmsd, ...gh].filter((r) => r?.date);
  if (!all.length) {
    return { latestScore: null as number | null, latestDate: null as string | null };
  }
  const latest = all.reduce((a, b) =>
    new Date(a.date!).getTime() >= new Date(b.date!).getTime() ? a : b,
  );
  return {
    latestScore: latest.performance_score ?? null,
    latestDate: latest.date ?? null,
  };
}
