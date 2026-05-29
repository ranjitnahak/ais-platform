import { Link } from 'react-router-dom';

function formatSessionTime(startTime) {
  if (!startTime) return null;
  return String(startTime).slice(0, 5);
}

export function DailyCheckInCard({ doneToday }) {
  return (
    <section className="rounded-2xl border border-[var(--color-primary)] bg-[var(--color-surface-container)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">Daily check-in</p>
          <h2 className="mt-1 text-base font-bold text-[var(--color-on-surface)]">Morning wellness</h2>
        </div>
        <span className="text-[11px] font-medium text-[var(--color-on-surface-variant)]">
          {doneToday ? 'Done today' : 'Not done'}
        </span>
      </div>
      <div className="mt-4">
        {doneToday ? (
          <span className="inline-flex rounded-full bg-[var(--color-tertiary-container)] px-3 py-1 text-[11px] font-bold text-[var(--color-on-tertiary)]">
            Submitted
          </span>
        ) : (
          <Link
            to="/athlete-log"
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--color-primary)] text-sm font-black uppercase tracking-widest text-[var(--color-on-primary)]"
          >
            Submit wellness
          </Link>
        )}
      </div>
    </section>
  );
}

export function TodaySessionCard({ session }) {
  return (
    <section className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">Today&apos;s session</p>
      {!session ? (
        <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">No session scheduled</p>
      ) : (
        <div className="mt-2">
          <p className="text-base font-bold text-[var(--color-on-surface)]">{session.name}</p>
          {formatSessionTime(session.start_time) && (
            <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">{formatSessionTime(session.start_time)}</p>
          )}
        </div>
      )}
    </section>
  );
}

export function AthleteStatsRow({ streakDays, streakCount, lastRpe, lastRpeDateLabel }) {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="grid grid-cols-2 gap-3">
      <section className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">Streak</p>
        <div className="mt-3 flex items-end justify-between gap-1">
          {streakDays.map((day) => {
            const isToday = day.date === today;
            const filled = day.submitted;
            const half = isToday && !filled;
            return (
              <span
                key={day.date}
                className={`h-10 flex-1 rounded-sm ${
                  filled
                    ? 'bg-[var(--color-primary)]'
                    : half
                      ? 'bg-[var(--color-primary)] opacity-50'
                      : 'bg-[var(--color-surface-variant)]'
                }`}
              />
            );
          })}
        </div>
        <p className="mt-2 text-[11px] font-medium text-[var(--color-on-surface-variant)]">{streakCount} days</p>
      </section>

      <section className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">Last RPE</p>
        <p className="mt-2 text-[18px] font-bold text-[var(--color-on-surface)]">
          {lastRpe == null ? '—' : `${lastRpe}/10`}
        </p>
        {lastRpe != null && lastRpeDateLabel && (
          <p className="mt-1 text-[11px] text-[var(--color-on-surface-variant)]">{lastRpeDateLabel}</p>
        )}
      </section>
    </div>
  );
}

export function QuickActionsCard() {
  return (
    <section className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">Quick actions</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link
          to="/athlete-log"
          className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-outline-variant)] text-sm font-bold text-[var(--color-on-surface)]"
        >
          Log RPE
        </Link>
        <Link
          to="/athlete-data"
          className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-outline-variant)] text-sm font-bold text-[var(--color-on-surface)]"
        >
          My reports
        </Link>
      </div>
    </section>
  );
}
