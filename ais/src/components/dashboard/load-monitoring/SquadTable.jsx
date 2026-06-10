import { athleteInitialsFromAthlete } from '../../../lib/athleteName';
import { getAcwrZone, getLoadSignal, getMonotonyZone } from '../../../lib/loadCalculations';

const ZONE_BADGE = {
  safe: 'bg-[color-mix(in_srgb,var(--color-excellent)_20%,transparent)] text-[var(--color-excellent)]',
  caution: 'bg-[color-mix(in_srgb,var(--color-primary-container)_20%,transparent)] text-[var(--color-primary-container)]',
  danger: 'bg-[color-mix(in_srgb,var(--color-error-container)_25%,transparent)] text-[var(--color-error)]',
};

const SIGNAL_STYLE = {
  spike: 'text-[var(--color-error)]',
  monitor: 'text-[var(--color-primary-container)]',
  optimal: 'text-[var(--color-excellent)]',
  low: 'text-[var(--color-outline)]',
};

const SIGNAL_LABEL = {
  spike: '↑ spike',
  monitor: '→ monitor',
  optimal: '✓ optimal',
  low: '↓ low load',
};

function MonotonyBar({ monotony }) {
  const zone = getMonotonyZone(monotony);
  const width = monotony != null ? Math.min((monotony / 2.5) * 100, 100) : 0;
  const barColor = zone === 'danger'
    ? 'var(--color-error)'
    : zone === 'caution'
      ? 'var(--color-primary-container)'
      : 'var(--color-excellent)';

  return (
    <div className="mt-1 h-1 w-full max-w-[4rem] overflow-hidden rounded-full bg-[var(--color-surface)]">
      <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: barColor }} />
    </div>
  );
}

export default function SquadTable({ rows, methodLabel, rangeLabel }) {
  if (!rows?.length) {
    return (
      <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6 text-center text-sm text-[var(--color-on-surface-variant)]">
        No athletes in scope.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)] px-5 py-3">
        <h3 className="text-sm font-black text-[var(--color-on-surface)]">
          Squad breakdown — {rangeLabel} period · {methodLabel}
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]">Sorted by ACWR ↓</span>
      </div>
      <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-widest text-[var(--color-outline)]">
            <th className="px-5 py-3">Athlete</th>
            <th className="px-3 py-3 text-center">ACWR</th>
            <th className="px-3 py-3 text-center">Monotony</th>
            <th className="px-3 py-3 text-center">Strain</th>
            <th className="px-3 py-3 text-center">Sessions</th>
            <th className="px-5 py-3 text-right">Signal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-outline-variant)]">
          {rows.map((row) => {
            const zone = getAcwrZone(row.acwr);
            const signal = getLoadSignal(row.acwr);
            return (
              <tr key={row.athlete.id}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface)] text-xs font-black text-[var(--color-on-surface)]">
                      {athleteInitialsFromAthlete(row.athlete)}
                    </div>
                    <div>
                      <p className="font-black text-[var(--color-on-surface)]">{row.athlete.full_name}</p>
                      <p className="text-[10px] text-[var(--color-outline)]">{row.athlete.position || '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  {row.insufficientData ? (
                    <span className="cursor-help text-[var(--color-outline)]" title="Insufficient data">—</span>
                  ) : (
                    <span className={`inline-block rounded-lg px-2.5 py-1 text-sm font-black ${ZONE_BADGE[zone] ?? ''}`}>
                      {row.acwr?.toFixed(2) ?? '—'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="font-black text-[var(--color-on-surface)]">
                    {row.monotony != null ? row.monotony.toFixed(1) : '—'}
                  </span>
                  <MonotonyBar monotony={row.monotony} />
                </td>
                <td className="px-3 py-3 text-center font-black text-[var(--color-on-surface)]">
                  {row.strain != null ? row.strain.toLocaleString() : '—'}
                </td>
                <td className="px-3 py-3 text-center font-black text-[var(--color-on-surface)]">{row.sessions}</td>
                <td className={`px-5 py-3 text-right text-xs font-black ${SIGNAL_STYLE[signal] ?? ''}`}>
                  {signal ? SIGNAL_LABEL[signal] : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
