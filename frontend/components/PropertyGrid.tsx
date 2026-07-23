import PropertyCard from './PropertyCard';
import type { PropertyCardData } from '@/lib/types';

// The My Properties grid (FR-3.2/3.3/3.4). Cards arrive already sorted by
// `order` ascending (server-side). The first card is featured (full-width); the
// remaining cards fill a responsive 3-column grid.
export default function PropertyGrid({ cards }: { cards: PropertyCardData[] }) {
  const [featured, ...rest] = cards;

  return (
    <div className="space-y-6">
      {featured ? <PropertyCard card={featured} featured /> : null}

      {rest.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {rest.map((card) => (
            <PropertyCard key={card.id} card={card} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
