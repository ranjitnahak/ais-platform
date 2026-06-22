function StatCard({ label, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[var(--color-on-surface)]">{value ?? '—'}</p>
      {subtitle && (
        <p className="mt-1 text-[10px] text-[var(--color-on-surface-variant)]">{subtitle}</p>
      )}
    </div>
  );
}

export default function AttendanceMetricCards({ squadMetrics, rangeLabel }) {
  const rate = squadMetrics?.attendanceRate;
  const rateDisplay = Number.isFinite(rate) ? `${rate}%` : '—';

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Attendance rate"
        value={rateDisplay}
        subtitle={`Squad weighted · ${rangeLabel}`}
      />
      <StatCard
        label="Exceptions"
        value={squadMetrics?.exceptionCount ?? 0}
        subtitle="Late + absent marks"
      />
      <StatCard
        label="Without notice"
        value={squadMetrics?.withoutNoticeCount ?? 0}
        subtitle="Uninformed late or absent"
      />
      <StatCard
        label="Late arrivals"
        value={squadMetrics?.lateCount ?? 0}
        subtitle="Counted as attended"
      />
    </div>
  );
}
