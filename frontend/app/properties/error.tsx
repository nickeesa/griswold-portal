'use client';

import { Button } from '@/components/ui/button';

// Error boundary for failed fetches. Shows a generic message — never raw error
// detail or Strapi internals (Technical Spec §4.12 / §9).
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="rounded-lg border border-dashed border-border bg-white px-6 py-16 text-center">
        <p className="text-muted-foreground">Something went wrong loading this page.</p>
        <Button variant="outline" className="mt-4" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </main>
  );
}
