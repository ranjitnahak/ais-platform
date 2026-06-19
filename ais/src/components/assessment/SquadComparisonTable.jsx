import { athleteDisplayName, athleteInitialsFromAthlete } from '../../lib/athleteName';
import { TierPill } from './ProgressionTable';

function formatValue(value, unit) {
  if (value == null) return '—';
  const formatted = Number.isInteger(value) ? value : value.toFixed(2);
  return unit ? `${formatted}${unit === 'seconds' ? 's' : ` ${unit}`}` : formatted;
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

export default function SquadComparisonTable({ squadRows, test }) {
  if (!squadRows?.length) return null;

  const unit = test?.unit === 'seconds' ? 's' : test?.unit;
  const maxMagnitude = Math.max(...squadRows.map((r) => r.improvementMagnitude), 0.001);

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <table className="w-full min-w-[960px] text-left text-sm">
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
              Percentile Δ
            </th>
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Composite percentile
            </th>
            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Tier change
            </th>
          </tr>
        </thead>
        <tbody>
          {squadRows.map((row) => {
            const athlete = row.athlete;
            const barWidth = row.hasTwoDates ? (row.improvementMagnitude / maxMagnitude) * 100 : 0;
            const deltaPositive = row.delta > 0;
            const improvementPositive = row.improvementDelta > 0;
            const pctDeltaPositive = row.percentileDelta > 0;

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
                  {row.hasTwoDates && row.improvementDelta != null ? (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-full max-w-[80px] rounded-full bg-[var(--color-surface-container-high)]">
                        <div
                          className={`h-2 rounded-full ${
                            improvementPositive
                              ? 'bg-[var(--color-excellent)]'
                              : row.improvementDelta < 0
                                ? 'bg-[var(--color-error)]'
                                : 'bg-[var(--color-on-surface-variant)]'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-black ${
                          improvementPositive
                            ? 'text-[var(--color-excellent)]'
                            : row.improvementDelta < 0
                              ? 'text-[var(--color-error)]'
                              : 'text-[var(--color-on-surface-variant)]'
                        }`}
                      >
                        {row.improvementDelta > 0 ? '+' : ''}
                        {row.improvementDelta.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[var(--color-on-surface-variant)]">—</span>
                  )}
                </td>
                <td
                  className={`px-4 py-3 font-black ${
                    row.percentileDelta == null
                      ? 'text-[var(--color-on-surface-variant)]'
                      : pctDeltaPositive
                        ? 'text-[var(--color-excellent)]'
                        : row.percentileDelta < 0
                          ? 'text-[var(--color-error)]'
                          : 'text-[var(--color-on-surface-variant)]'
                  }`}
                >
                  {row.percentileDelta != null
                    ? `${row.percentileDelta > 0 ? '+' : ''}${row.percentileDelta.toFixed(1)}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  {row.compositePercentile != null ? (
                    <span className="font-bold text-[var(--color-on-surface)]">
                      {formatOrdinal(row.compositePercentile)}
                      {row.compositeTier ? ` (${row.compositeTier})` : ''}
                    </span>
                  ) : (
                    <span className="text-[var(--color-on-surface-variant)]">—</span>
                  )}
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
