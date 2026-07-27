'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { distinctYears } from '@/lib/reports';
import { scoreColor } from '@/lib/score';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EmptyState from './EmptyState';
import type { ReportRow } from '@/lib/types';

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmtScore(n: number | null) {
  return n == null || !Number.isFinite(n) ? '—' : n.toFixed(2);
}
function fmtScorePct(n: number | null) {
  const s = fmtScore(n);
  return s === '—' ? s : `${s}%`;
}
function fmtDate(date: string | null) {
  if (!date) return '—';
  const [y, m] = date.slice(0, 10).split('-');
  const month = SHORT_MONTHS[Number(m) - 1];
  return y && month ? `${month} ${y}` : date;
}
function fmtQuarter(date: string | null) {
  if (!date) return '—';
  const [y, m] = date.slice(0, 10).split('-');
  const quarter = Math.floor((Number(m) - 1) / 3) + 1;
  return y && m ? `Q${quarter}-${y}` : date;
}

// Reports tab (FR-4.3/4.4/4.6). Receives the already-scoped, merged rows and
// filters in the browser — no extra API calls. Year filter + case-insensitive
// report-type search; "All" resets the year filter (AC-16). Property Score is
// rendered in the color scale; Download always uses the proxy `downloadHref`.
export default function ReportsTab({ rows }: { rows: ReportRow[] }) {
  const [year, setYear] = useState<'all' | number>('all');
  const [search, setSearch] = useState('');

  const years = useMemo(() => distinctYears(rows), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesYear = year === 'all' || (r.date ? Number(r.date.slice(0, 4)) === year : false);
      const matchesSearch = q === '' || (r.type ?? '').toLowerCase().includes(q);
      return matchesYear && matchesSearch;
    });
  }, [rows, year, search]);

  if (!rows.length) {
    return <EmptyState message="No reports have been published for this property yet." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter reports by year">
          <Button
            variant={year === 'all' ? 'default' : 'outline'}
            size="sm"
            className={cn(year === 'all' && 'bg-hotel-green text-white hover:bg-hotel-green-hover')}
            aria-pressed={year === 'all'}
            onClick={() => setYear('all')}
          >
            All
          </Button>
          {years.map((y) => (
            <Button
              key={y}
              variant={year === y ? 'default' : 'outline'}
              size="sm"
              className={cn(year === y && 'bg-hotel-green text-white hover:bg-hotel-green-hover')}
              aria-pressed={year === y}
              onClick={() => setYear(y)}
            >
              {y}
            </Button>
          ))}
        </div>

        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search report type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search reports by type"
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No reports match your filters." />
      ) : (
        <ul className="space-y-4">
          {filtered.map((r) => (
            <li
              key={`${r.source}-${r.id}`}
              className="flex flex-col gap-4 rounded-lg border border-border bg-white p-6 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-medium text-foreground">
                    {fmtQuarter(r.date)} {r.type ?? 'Report'}
                  </h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{fmtDate(r.date)}</p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Property Score</p>
                  <p
                    className="text-2xl font-bold"
                    style={{ color: scoreColor(r.performanceScore) }}
                  >
                    {fmtScorePct(r.performanceScore)}
                  </p>
                  {/* GH rows show spa score; BDTMSD rows do not (AC-14). */}
                  {r.source === 'GH' ? (
                    <p className="text-xs text-muted-foreground">Spa {fmtScore(r.spaScore)}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {r.fullReport ? (
                    <Button
                      asChild
                      size="sm"
                      className="bg-hotel-green text-white hover:bg-hotel-green-hover"
                    >
                      <a href={r.fullReport} target="_blank" rel="noopener noreferrer">
                        View Report
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </Button>
                  ) : null}
                  {r.downloadHref ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={r.downloadHref}>Download</a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
