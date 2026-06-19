import { formatShortTestingDate } from '../../lib/trendEngine';

export default function CoverageTestMatrix({ testDateMatrix, selectedTestingDates }) {
  if (!testDateMatrix?.length || !selectedTestingDates?.length) return null;

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
          </tr>
        </thead>
        <tbody>
          {testDateMatrix.map(({ test, cells }) => {
            const cellBySession = Object.fromEntries(cells.map((c) => [c.sessionId, c]));
            return (
              <tr
                key={test.id}
                className="border-b border-[var(--color-outline-variant)] last:border-b-0"
              >
                <td className="px-4 py-3 font-bold text-[var(--color-on-surface)]">{test.name}</td>
                {sortedDates.map((session) => {
                  const cell = cellBySession[session.id];
                  return (
                    <td
                      key={session.id}
                      className="px-4 py-3 text-[var(--color-on-surface)]"
                    >
                      {cell != null ? `${cell.pct}%` : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
