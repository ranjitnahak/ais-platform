import { formatShortTestingDate } from '../../lib/trendEngine';

function TrendArrow({ direction }) {
  if (direction === 'improving') return <span className="text-[var(--color-excellent)]">↑</span>;
  if (direction === 'declining') return <span className="text-[var(--color-error)]">↓</span>;
  return <span className="text-[var(--color-on-surface-variant)]">→</span>;
}

function formatOrdinal(n) {
  if (n == null) return '';
  const rounded = Math.round(n);
  const mod10 = rounded % 10;
  const mod100 = rounded % 100;
  let suffix = 'th';
  if (mod10 === 1 && mod100 !== 11) suffix = 'st';
  else if (mod10 === 2 && mod100 !== 12) suffix = 'nd';
  else if (mod10 === 3 && mod100 !== 13) suffix = 'rd';
  return `${rounded}${suffix}`;
}

export default function CompositeClassificationCard({ compositeClassification }) {
  if (!compositeClassification) return null;

  const { progression, overallDelta, trendDirection } = compositeClassification;
  const deltaClass =
    overallDelta > 0
      ? 'text-[var(--color-excellent)]'
      : overallDelta < 0
        ? 'text-[var(--color-error)]'
        : 'text-[var(--color-on-surface-variant)]';

  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
        Overall classification
      </p>
      <div className="mt-2 space-y-1">
        {progression.map((point) => (
          <p key={point.sessionId} className="text-sm font-bold text-[var(--color-on-surface)]">
            {formatShortTestingDate(point.date)}:{' '}
            {point.percentile != null ? (
              <>
                {formatOrdinal(point.percentile)} percentile ({point.tierName})
              </>
            ) : (
              <span className="text-[var(--color-on-surface-variant)]">—</span>
            )}
          </p>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`text-lg font-black ${deltaClass}`}>
          {overallDelta != null
            ? `${overallDelta > 0 ? '+' : ''}${overallDelta.toFixed(1)}`
            : '—'}
        </span>
        <TrendArrow direction={trendDirection} />
      </div>
    </div>
  );
}
