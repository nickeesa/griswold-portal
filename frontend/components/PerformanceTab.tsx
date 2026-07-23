import { lookerEmbedSrc, safeHttpUrl } from '@/lib/embed';
import EmptyState from './EmptyState';

// Performance tab (FR-4.7). The field is free text holding a Looker Studio embed
// URL by editorial convention. It is embedded as an iframe ONLY when it passes
// the host guard (https + lookerstudio.google.com); any other origin/non-URL is
// never embedded. Fallbacks: a safe external link for another http(s) URL, or the
// raw text otherwise. The relaxed frame-src CSP is scoped to Looker; this code
// guard is the second layer (DD-10 / §6).
export default function PerformanceTab({
  content,
  label,
}: {
  content: string | null;
  label: string;
}) {
  if (!content || !content.trim()) {
    return <EmptyState message={`No ${label} content has been published yet.`} />;
  }

  const embed = lookerEmbedSrc(content);
  if (embed) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <iframe
          src={embed}
          title={`${label} dashboard`}
          className="h-[800px] w-full border-0"
          loading="lazy"
          allowFullScreen
        />
      </div>
    );
  }

  // Not a Looker embed: never iframe it. If it's another http(s) URL, offer a
  // safe out-of-band link; otherwise show the raw text (never embedded).
  const link = safeHttpUrl(content);
  if (link) {
    return (
      <div className="rounded-lg border border-border bg-white p-6">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-hotel-green underline underline-offset-4 hover:text-hotel-green-hover"
        >
          Open {label} dashboard
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    );
  }

  return (
    <div className="whitespace-pre-line rounded-lg border border-border bg-white p-6 leading-relaxed">
      {content}
    </div>
  );
}
