// Performance-score color scale (FR-4.4). Ported from the prototype's
// getPerformanceColor thresholds. Non-numeric / non-finite (TBD / "—") renders grey.
export function scoreColor(score: number | string | null): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) return '#6b7280'; // grey: TBD / "—"
  if (score >= 90) return '#34a853'; // green
  if (score >= 85) return '#a4b164'; // olive
  if (score >= 77) return '#e69138'; // orange
  return '#ea4335'; // red
}
