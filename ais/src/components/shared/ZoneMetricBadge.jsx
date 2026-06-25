import { zoneBadgeClass } from '../../lib/zoneBadge';

export default function ZoneMetricBadge({ zone, children, className = '', empty = '—' }) {
  if (!zone) {
    return <span className="text-[var(--color-outline)]">{empty}</span>;
  }
  return (
    <span className={`inline-block rounded-lg px-2.5 py-1 text-sm font-black ${zoneBadgeClass(zone)} ${className}`}>
      {children}
    </span>
  );
}
