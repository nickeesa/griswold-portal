import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { PropertyCardData } from '@/lib/types';

function formatScore(score: number | null): string {
  return score == null ? '—' : score.toFixed(2);
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  // Parse from the ISO string parts to avoid time-zone drift on display.
  const [y, m, d] = date.slice(0, 10).split('-');
  if (!y || !m || !d) return date;
  return `${m}/${d}/${y}`;
}

// A single property card (FR-3.2). `featured` gives the first card a wider
// aspect ratio and larger overlaid text. The whole card is a link to the detail
// page; image + dark gradient + bottom-aligned name/location/latest score.
export default function PropertyCard({
  card,
  featured = false,
}: {
  card: PropertyCardData;
  featured?: boolean;
}) {
  return (
    <Link
      href={`/properties/${card.id}`}
      className="group relative block overflow-hidden rounded-lg shadow-md transition-shadow hover:shadow-xl"
    >
      <div className={cn('relative aspect-[4/3]', featured && 'md:aspect-[21/9]')}>
        {card.image ? (
          // Strapi media is remote; a plain <img> avoids next/image remote config.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image}
            alt={card.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          // No image: a neutral block, not <img src=""> (which re-requests the page URL).
          <div className="absolute inset-0 bg-hotel-gray-medium" aria-hidden="true" />
        )}

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
        />

        <div className={cn('absolute inset-x-0 bottom-0 text-white', featured ? 'p-8' : 'p-4')}>
          <h2 className={cn('font-bold', featured ? 'text-2xl md:text-3xl' : 'text-lg')}>
            {card.name}
          </h2>
          <p className={cn('mt-1 text-gray-200', featured ? 'text-base' : 'text-sm')}>
            {card.location ?? 'Location not set'}
          </p>
          <p className={cn('mt-2 text-gray-300', featured ? 'text-sm' : 'text-xs')}>
            Latest score {formatScore(card.latestScore)} · {formatDate(card.latestDate)}
          </p>
        </div>
      </div>
    </Link>
  );
}
