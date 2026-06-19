import { useMemo, useState } from 'react';
import { athleteDisplayName } from '../../lib/athleteName';
import TierValue from './TierValue';

function DeltaIndicator({ delta, unit }) {
  if (delta == null) return null;
  const deltaClass =
    delta > 0
      ? 'text-[var(--color-excellent)]'
      : delta < 0
        ? 'text-[var(--color-error)]'
        : 'text-[var(--color-on-surface-variant)]';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const suffix = unit === 'seconds' || unit === 's' ? 's' : unit ? ` ${unit}` : '';
  return (
    <span className={`text-[10px] font-bold ${deltaClass}`}>
      {arrow} {delta > 0 ? '+' : ''}{delta.toFixed(2)}{suffix}
    </span>
  );
}

export default function MatrixView({ matrixRows, selectedTests, onCellClick }) {
  const [sortDir, setSortDir] = useState('desc');

  const sortedRows = useMemo(() => {
    const rows = [...(matrixRows ?? [])];
    rows.sort((a, b) => {
      const aVal = a.compositePercentile;
      const bVal = b.compositePercentile;
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return rows;
  }, [matrixRows, sortDir]);

  if (!selectedTests?.length) {
    return (
      <p className="text-center text-sm text-[var(--color-on-surface-variant)]">
        Select tests to view the matrix
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-outline-variant)]">
            <th className="sticky left-0 z-10 bg-[var(--color-surface-container)] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Athlete
            </th>
            <th className="px-4 py-3">
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary-container)] hover:underline"
              >
                Composite percentile {sortDir === 'asc' ? '↑' : '↓'}
              </button>
            </th>
            {selectedTests.map((test) => (
              <th
                key={test.id}
                className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]"
              >
                {test.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.athleteId} className="border-b border-[var(--color-outline-variant)] last:border-b-0">
              <td className="sticky left-0 z-10 bg-[var(--color-surface-container)] px-4 py-3 font-bold text-[var(--color-on-surface)]">
                {athleteDisplayName(row.athlete)}
              </td>
              <td className="px-4 py-3">
                {row.compositePercentile != null ? (
                  <TierValue
                    mode="pill"
                    percentile={row.compositePercentile}
                    tier={row.compositeTier}
                    tierColor={row.compositeTierColor}
                  />
                ) : (
                  <span className="text-[var(--color-on-surface-variant)]">—</span>
                )}
              </td>
              {selectedTests.map((test) => {
                const cell = row.tests?.[test.id];
                const unit = test.unit === 'seconds' ? 's' : test.unit;
                return (
                  <td key={test.id} className="px-4 py-3">
                    {cell?.latestValue != null ? (
                      <button
                        type="button"
                        onClick={() => onCellClick({ athleteId: row.athleteId, testId: test.id })}
                        className="flex flex-col items-start gap-0.5 rounded-lg px-1 py-0.5 text-left hover:bg-[var(--color-surface)]"
                      >
                        <TierValue
                          mode="value-only"
                          value={cell.latestValue}
                          tier={cell.tierName}
                          tierColor={cell.tierColor}
                          unit={unit}
                        />
                        <DeltaIndicator delta={cell.delta} unit={unit} />
                      </button>
                    ) : (
                      <span className="text-[var(--color-on-surface-variant)]">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
