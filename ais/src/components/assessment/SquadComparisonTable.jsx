import { athleteDisplayName, athleteInitialsFromAthlete } from '../../lib/athleteName';
import { TierPill } from './ProgressionTable';

function formatValue(value, unit) {
  if (value == null) return '—';
  const formatted = Number.isInteger(value) ? value : value.toFixed(2);
  return unit ? `${formatted}${unit === 'seconds' ? 's' : ` ${unit}`}` : formatted;
}

export default function SquadComparisonTable({ squadProgression, test }) {
  if (!squadProgression.length) return null;

  const maxMagnitude = Math.max(...squadProgression.map((r) => r.improvementMagnitude), 0.001);
  const unit = test?.unit === 'seconds' ? 's' : test?.unit;

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-outline-variant)]">
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Athlete
            </th>
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              First value
            </th>
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Last value
            </th>
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Δ
            </th>
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Improvement
            </th>
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Tier change
            </th>
          </tr>
        </thead>
        <tbody>
          {squadProgression.map((row) => {
            const athlete = row.athlete;
            const barWidth = (row.improvementMagnitude / maxMagnitude) * 100;
            const deltaPositive = row.delta > 0;

            return (
              <tr key={row.athleteId} className="border-b border-[var(--color-outline-variant)] last:border-b-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {athlete?.photo_url ? (
                      <img
                        src={athlete.photo_url}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-container-high)] text-[10px] font-black">
                        {athleteInitialsFromAthlete(athlete ?? { full_name: row.athleteName })}
                      </span>
                    )}
                    <span className="font-bold text-[var(--color-on-surface)]">
                      {athleteDisplayName(athlete ?? { full_name: row.athleteName })}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-bold text-[var(--color-on-surface)]">
                  {formatValue(row.firstValue, unit)}
                </td>
                <td className="px-4 py-3 font-bold text-[var(--color-on-surface)]">
                  {formatValue(row.lastValue, unit)}
                </td>
                <td
                  className={`px-4 py-3 font-black ${
                    deltaPositive
                      ? 'text-[var(--color-excellent)]'
                      : row.delta < 0
                        ? 'text-[var(--color-error)]'
                        : 'text-[var(--color-on-surface-variant)]'
                  }`}
                >
                  {row.delta != null
                    ? `${row.delta > 0 ? '+' : ''}${row.delta.toFixed(2)}${unit === 's' ? 's' : unit ? ` ${unit}` : ''}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="h-2 w-full max-w-[120px] rounded-full bg-[var(--color-surface-container-high)]">
                    <div
                      className="h-2 rounded-full bg-[var(--color-primary-container)]"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  {row.tierChanged ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <TierPill tierName={row.firstTierName} tierColor="--color-on-surface-variant" />
                      <span className="text-[var(--color-on-surface-variant)]">→</span>
                      <TierPill tierName={row.lastTierName} tierColor="--color-primary-container" />
                    </div>
                  ) : (
                    <span className="text-[var(--color-on-surface-variant)]">No change</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
