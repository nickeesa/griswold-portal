// Empty state (FR-3.7) — clients with no properties, or a tab with no content.
export default function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-white px-6 py-16 text-center text-muted-foreground">
      <p>{message}</p>
    </div>
  );
}
