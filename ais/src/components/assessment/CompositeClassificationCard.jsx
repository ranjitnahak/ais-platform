import { formatShortTestingDate } from '../../lib/trendEngine';
import TierValue from './TierValue';

function TrendArrow({ direction }) {
  if (direction === 'improving') return <span className="text-[var(--color-excellent)]">↑</span>;
  if (direction === 'declining') return <span className="text-[var(--color-error)]">↓</span>;
  return <span className="text-[var(--color-on-surface-variant)]">→</span>;
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
      <div className="mt-2 space-y-2">
        {progression.map((point) => (
          <div key={point.sessionId} className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--color-on-surface-variant)]">
              {formatShortTestingDate(point.date)}:
            </span>
            {point.percentile != null ? (
              <TierValue
                mode="pill"
                percentile={point.percentile}
                tier={point.tierName}
                tierColor={point.tierColor}
              />
            ) : (
              <span className="text-sm text-[var(--color-on-surface-variant)]">—</span>
            )}
          </div>
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
