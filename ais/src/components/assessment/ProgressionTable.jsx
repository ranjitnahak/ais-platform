import { formatShortTestingDate } from '../../lib/trendEngine';

function TierPill({ tierName, tierColor }) {
  if (!tierName || tierName === 'Unclassified') {
    return (
      <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container-high)]">
        —
      </span>
    );
  }

  const cssVar = tierColor?.startsWith('--') ? tierColor : `--color-${tierColor}`;
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        color: `var(${cssVar}, var(--color-on-surface))`,
        background: `color-mix(in srgb, var(${cssVar}, var(--color-primary-container)) 18%, var(--color-surface-container))`,
      }}
    >
      {tierName}
    </span>
  );
}

function formatValue(value, unit) {
  if (value == null) return '—';
  const formatted = Number.isInteger(value) ? value : value.toFixed(2);
  return unit ? `${formatted}${unit === 'seconds' ? 's' : ` ${unit}`}` : formatted;
}

function deltaClass(delta, direction) {
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
  testsById,
}) {
  if (!selectedTests.length || !selectedTestingDates.length) return null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-outline-variant)]">
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Test
            </th>
            {selectedTestingDates.map((session) => (
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
                {selectedTestingDates.map((session) => {
                  const point = pointsBySession[session.id];
                  return (
                    <td key={session.id} className="px-4 py-3">
                      {point ? (
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-[var(--color-on-surface)]">
                            {formatValue(point.value, unit)}
                            {crossings.has(session.id) && (
                              <span className="ml-1 text-[var(--color-primary-container)]" title="Tier crossing">
                                ↑
                              </span>
                            )}
                          </span>
                          <TierPill tierName={point.tierName} tierColor={point.tierColor} />
                        </div>
                      ) : (
                        <span className="text-[var(--color-on-surface-variant)]">—</span>
                      )}
                    </td>
                  );
                })}
                <td className={`px-4 py-3 font-black ${deltaClass(progression?.overallDelta, test.direction)}`}>
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

export { TierPill };
