export default function PropertyDetailLoading() {
  return (
    <div className="min-h-screen bg-hotel-gray-light">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0 space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="h-6 w-56 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" aria-hidden />
        </div>
      </header>
      <main
        className="mx-auto max-w-7xl space-y-6 px-6 py-8"
        aria-busy="true"
        aria-label="Loading property"
      >
        <div className="flex gap-6 border-b border-border pb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-5 w-24 animate-pulse rounded bg-muted" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </main>
    </div>
  );
}
