import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Friendly not-found for the guard case (AC-18). Shown when the server returns
// 404 for a property not assigned to the client — no indication it exists.
export default function NotFound() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="rounded-lg border border-dashed border-border bg-white px-6 py-16 text-center">
        <p className="text-muted-foreground">
          This property isn’t available on your account.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/properties">Back to My Properties</Link>
        </Button>
      </div>
    </main>
  );
}
