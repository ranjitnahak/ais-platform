import { formatShortTestingDate } from '../../lib/trendEngine';
import TierValue from './TierValue';

function deltaClass(delta) {
  if (delta == null) return 'text-[var(--color-on-surface-variant)]';
  const improving = delta > 0;
  return improving
    ? 'text-[var(--color-excellent)]'
    : delta < 0
      ? 'text-[var(--color-error)]'
      : 'text-[var(--color-on-surface-variant)]';
}

export default function ProgressionTable({
  selectedTests,
  selectedTestingDates,
  individualProgressions,
}) {
  if (!selectedTests.length || !selectedTestingDates.length) return null;

  const sortedDates = [...selectedTestingDates].sort(
    (a, b) => new Date(a.assessed_on) - new Date(b.assessed_on),
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-outline-variant)]">
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Test
            </th>
            {sortedDates.map((session) => (
              <th
                key={session.id}
                className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]"
              >
                {formatShortTestingDate(session.assessed_on)}
              </th>
            ))}
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Overall Δ
            </th>
          </tr>
        </thead>
        <tbody>
          {selectedTests.map((test) => {
            const progression = individualProgressions[test.id];
            const pointsBySession = Object.fromEntries(
              (progression?.dataPoints ?? []).map((p) => [p.sessionId, p]),
            );
            const crossings = new Set(
              (progression?.tierCrossings ?? []).map((c) => c.sessionId),
            );
            const unit = test.unit === 'seconds' ? 's' : test.unit;

            return (
              <tr key={test.id} className="border-b border-[var(--color-outline-variant)] last:border-b-0">
                <td className="px-4 py-3 font-bold text-[var(--color-on-surface)]">{test.name}</td>
                {sortedDates.map((session) => {
                  const point = pointsBySession[session.id];
                  return (
                    <td key={session.id} className="px-4 py-3">
                      {point ? (
                        <div className="flex items-center gap-1">
                          <TierValue
                            mode="value-only"
                            value={point.value}
                            tier={point.tierName}
                            tierColor={point.tierColor}
                            unit={unit}
                          />
                          {crossings.has(session.id) && (
                            <span className="text-[var(--color-primary-container)]" title="Tier crossing">
                              ↑
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--color-on-surface-variant)]">—</span>
                      )}
                    </td>
                  );
                })}
                <td className={`px-4 py-3 font-black ${deltaClass(progression?.overallDelta)}`}>
                  {progression?.overallDelta != null
                    ? `${progression.overallDelta > 0 ? '+' : ''}${progression.overallDelta.toFixed(2)}${unit === 's' ? 's' : unit ? ` ${unit}` : ''}`
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
