function attendanceRateBackground(rate) {
  if (!Number.isFinite(rate)) return null;
  if (rate >= 90) return 'var(--color-excellent)';
  if (rate >= 75) return 'var(--color-avg)';
  return 'var(--color-below-avg)';
}

function RateCell({ rate }) {
  const bg = attendanceRateBackground(rate);
  const label = Number.isFinite(rate) ? `${rate}%` : '—';

  if (!bg) {
    return <span className="text-[var(--color-on-surface-variant)]">{label}</span>;
  }

  return (
    <span
      className="inline-flex min-w-[3.5rem] justify-center rounded-full px-2.5 py-1 text-xs font-black text-[var(--color-on-surface)]"
      style={{ backgroundColor: `color-mix(in srgb, ${bg} 28%, transparent)` }}
    >
      {label}
    </span>
  );
}

export default function AttendanceAthleteTable({ rows, rangeLabel }) {
  if (!rows?.length) {
    return (
      <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6 text-center text-sm text-[var(--color-on-surface-variant)]">
        No athletes in scope for {rangeLabel}.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)] px-5 py-3">
        <h3 className="text-sm font-black text-[var(--color-on-surface)]">
          Athlete attendance — {rangeLabel}
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]">
          Sorted by rate ↑
        </span>
      </div>
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-widest text-[var(--color-outline)]">
            <th className="px-5 py-3">Athlete</th>
            <th className="px-3 py-3 text-center">Scheduled</th>
            <th className="px-3 py-3 text-center">Rate</th>
            <th className="px-3 py-3 text-center">Late</th>
            <th className="px-3 py-3 text-center">Absent</th>
            <th className="px-5 py-3 text-center">Without notice</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-outline-variant)]">
          {rows.map((row) => (
            <tr key={row.athleteId}>
              <td className="px-5 py-3 font-bold text-[var(--color-on-surface)]">{row.athleteName}</td>
              <td className="px-3 py-3 text-center text-[var(--color-on-surface-variant)]">{row.sessionsScheduled}</td>
              <td className="px-3 py-3 text-center">
                <RateCell rate={row.attendanceRate} />
              </td>
              <td className="px-3 py-3 text-center text-[var(--color-on-surface-variant)]">{row.lateCount}</td>
              <td className="px-3 py-3 text-center text-[var(--color-on-surface-variant)]">{row.absentCount}</td>
              <td className="px-5 py-3 text-center text-[var(--color-on-surface-variant)]">{row.withoutNoticeCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { attendanceRateBackground };
