'use client';

import { useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import ReportsTab from './ReportsTab';
import PerformanceTab from './PerformanceTab';
import type { ReportRow } from '@/lib/types';

type TabKey = 'reports' | 'property' | 'hotel' | 'fb' | 'spa';

// Five-tab property detail surface (FR-4.2): Reports, Property Performance, Hotel
// Performance, F&B Performance, Spa Performance. Reports are pre-mapped to view rows
// on the SERVER (see the RSC page) so the raw Strapi media URL never enters the
// client payload — only the proxy `downloadHref` does. Merging/filtering happen
// in the browser against those rows (no extra API calls). Performance tabs are
// shown only when their field has content (FR-4.3).
export default function TabBar({
  rows,
  propertyPerformance,
  hotelPerformance,
  fbPerformance,
  spaPerformance,
  propertyInfoHref,
}: {
  rows: ReportRow[];
  propertyPerformance: string | null;
  hotelPerformance: string | null;
  fbPerformance: string | null;
  spaPerformance: string | null;
  propertyInfoHref?: string | null;
}) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'reports', label: 'Reports' },
    ...(propertyPerformance?.trim()
      ? [{ key: 'property' as const, label: 'Property Performance' }]
      : []),
    ...(hotelPerformance?.trim() ? [{ key: 'hotel' as const, label: 'Hotel Performance' }] : []),
    ...(fbPerformance?.trim() ? [{ key: 'fb' as const, label: 'F&B Performance' }] : []),
    ...(spaPerformance?.trim() ? [{ key: 'spa' as const, label: 'Spa Performance' }] : []),
  ];

  const [active, setActive] = useState<TabKey>('reports');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // ARIA tabs keyboard pattern: arrow keys move between the VISIBLE tabs (with
  // wrap), Home/End jump to the ends. Activation follows focus.
  function onTabKeyDown(e: React.KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    let next = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = index === last ? 0 : index + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = index === 0 ? last : index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else return;
    e.preventDefault();
    setActive(tabs[next].key);
    tabRefs.current[next]?.focus();
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex flex-wrap gap-6" role="tablist" aria-label="Property sections">
          {tabs.map((t, i) => (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-controls="property-panel"
              aria-selected={active === t.key}
              tabIndex={active === t.key ? 0 : -1}
              className={cn(
                'border-b-2 px-1 py-4 text-sm font-medium uppercase tracking-wide transition-colors',
                active === t.key
                  ? 'border-hotel-green text-hotel-green'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActive(t.key)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {propertyInfoHref ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={propertyInfoHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Property information"
                  className="text-muted-foreground transition-colors hover:text-hotel-green"
                >
                  <HelpCircle className="h-5 w-5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>View property information</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>

      <div
        role="tabpanel"
        id="property-panel"
        aria-labelledby={`tab-${active}`}
        tabIndex={0}
        className="pt-6"
      >
        {active === 'reports' && <ReportsTab rows={rows} />}
        {active === 'property' && (
          <PerformanceTab content={propertyPerformance} label="Property Performance" />
        )}
        {active === 'hotel' && (
          <PerformanceTab content={hotelPerformance} label="Hotel Performance" />
        )}
        {active === 'fb' && <PerformanceTab content={fbPerformance} label="F&B Performance" />}
        {active === 'spa' && <PerformanceTab content={spaPerformance} label="Spa Performance" />}
      </div>
    </div>
  );
}
