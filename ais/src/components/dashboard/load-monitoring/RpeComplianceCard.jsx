import { useSessionConfig } from '../../../context/SessionConfigContext';

function formatSessionDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function RpeComplianceCard({ compliance }) {
  const { sessionTypeLabel } = useSessionConfig();
  const { logged, pending, absent, percent, sessionLabel, sessionType, sessionDate } = compliance ?? {};
  const total = (logged ?? 0) + (pending ?? 0) + (absent ?? 0);
  const loggedPct = total ? (logged / total) * 100 : 0;
  const pendingPct = total ? (pending / total) * 100 : 0;
  const absentPct = total ? (absent / total) * 100 : 0;

  const r = 40;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;
  const loggedLen = (loggedPct / 100) * circumference;
  const pendingLen = (pendingPct / 100) * circumference;
  const absentLen = (absentPct / 100) * circumference;

  const subtitle = sessionDate
    ? `${sessionTypeLabel(sessionType) || sessionLabel || 'Session'} · ${formatSessionDate(sessionDate)}`
    : 'No sessions in range';

  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">RPE Compliance</h3>
      <div className="mt-4 flex items-center gap-6">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-outline-variant)" strokeWidth="12" opacity="0.3" />
            {loggedLen > 0 && (
              <circle
                cx={cx} cy={cy} r={r} fill="none"
                stroke="var(--color-excellent)" strokeWidth="12"
                strokeDasharray={`${loggedLen} ${circumference - loggedLen}`}
                strokeDashoffset="0"
              />
            )}
            {pendingLen > 0 && (
              <circle
                cx={cx} cy={cy} r={r} fill="none"
                stroke="var(--color-primary-container)" strokeWidth="12"
                strokeDasharray={`${pendingLen} ${circumference - pendingLen}`}
                strokeDashoffset={-loggedLen}
              />
            )}
            {absentLen > 0 && (
              <circle
                cx={cx} cy={cy} r={r} fill="none"
                stroke="var(--color-outline)" strokeWidth="12"
                strokeDasharray={`${absentLen} ${circumference - absentLen}`}
                strokeDashoffset={-(loggedLen + pendingLen)}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-[var(--color-on-surface)]">{percent ?? 0}%</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-outline)]">logged</span>
          </div>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-excellent)]" />
            <span className="text-[var(--color-on-surface-variant)]">Logged</span>
            <span className="ml-auto font-black text-[var(--color-on-surface)]">{logged ?? 0}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary-container)]" />
            <span className="text-[var(--color-on-surface-variant)]">Pending</span>
            <span className="ml-auto font-black text-[var(--color-on-surface)]">{pending ?? 0}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-outline)]" />
            <span className="text-[var(--color-on-surface-variant)]">Absent</span>
            <span className="ml-auto font-black text-[var(--color-on-surface)]">{absent ?? 0}</span>
          </li>
        </ul>
      </div>
      <p className="mt-4 text-xs italic text-[var(--color-on-surface-variant)]">{subtitle}</p>
    </div>
  );
}
