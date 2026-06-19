import { useMemo, useState } from 'react';
import { formatShortTestingDate } from '../../lib/trendEngine';

export default function CoverageAthleteTable({ athleteRows, selectedTestingDates, testCount }) {
  const [sortDir, setSortDir] = useState('desc');

  const sortedDates = useMemo(
    () =>
      [...(selectedTestingDates ?? [])].sort(
        (a, b) => new Date(a.assessed_on) - new Date(b.assessed_on),
      ),
    [selectedTestingDates],
  );

  const sortedRows = useMemo(() => {
    const rows = [...(athleteRows ?? [])];
    rows.sort((a, b) => {
      const aVal = a.overallRatio;
      const bVal = b.overallRatio;
      if (aVal === bVal) return a.athleteName.localeCompare(b.athleteName);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return rows;
  }, [athleteRows, sortDir]);

  if (!sortedRows.length) {
    return (
      <p className="text-center text-sm text-[var(--color-on-surface-variant)]">
        No athletes in roster.
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
            {sortedDates.map((session) => (
              <th
                key={session.id}
                className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]"
              >
                {formatShortTestingDate(session.assessed_on)}
              </th>
            ))}
            <th className="px-4 py-3">
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
              >
                Overall completion {sortDir === 'asc' ? '↑' : '↓'}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={row.athlete.id}
              className="border-b border-[var(--color-outline-variant)] last:border-b-0"
            >
              <td className="sticky left-0 z-10 bg-[var(--color-surface-container)] px-4 py-3 font-bold text-[var(--color-on-surface)]">
                {row.athleteName}
              </td>
              {sortedDates.map((session) => {
                const completed = row.bySession[session.id] ?? 0;
                return (
                  <td
                    key={session.id}
                    className="px-4 py-3 text-[var(--color-on-surface)]"
                  >
                    {completed}/{testCount}
                  </td>
                );
              })}
              <td className="px-4 py-3 text-[var(--color-on-surface)]">
                {row.overallRaw}/{row.overallPossible} · {row.overallPct}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
