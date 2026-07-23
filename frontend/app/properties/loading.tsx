export default function PropertiesLoading() {
  return (
    <div className="min-h-screen bg-hotel-gray-light">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold uppercase tracking-wide text-hotel-green">
            Griswold Hospitality
          </span>
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" aria-hidden />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8" aria-busy="true" aria-label="Loading properties">
        <div className="mb-8 space-y-3">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </main>
    </div>
  );
}
