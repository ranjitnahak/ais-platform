import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sessionTypeLabel } from '../../lib/sessionTypeStyles';
import { useAthleteSessionRpe } from '../../hooks/useAthleteSessionRpe';
import SessionRpeInput from '../sessions/SessionRpeInput';

function formatSessionTime(startTime) {
  if (!startTime) return null;
  return String(startTime).slice(0, 5);
}

function isSessionStarted(sessionDate, startTime) {
  if (!sessionDate || !startTime) return false;
  const now = new Date();
  const [h, m] = String(startTime).split(':').map(Number);
  const sessionStart = new Date(`${sessionDate}T00:00:00`);
  sessionStart.setHours(h || 0, m || 0, 0, 0);
  return now >= sessionStart;
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

function TodaySessionItem({ session, onRpeLogged }) {
  const { logRpe, saving, error, clearError } = useAthleteSessionRpe();
  const [showSelector, setShowSelector] = useState(false);
  const [loggedRpe, setLoggedRpe] = useState(session.actualRpe);
  const [loggedDuration, setLoggedDuration] = useState(session.actualDurationMin);

  const sessionDate = session.session_date;
  const started = isSessionStarted(sessionDate, session.start_time);
  const typeLabel = sessionTypeLabel(session.session_type) || 'Session';
  const timeLabel = formatSessionTime(session.start_time);
  const venueTime = [session.venue, timeLabel].filter(Boolean).join(' · ');
  const sessionId = session.sessionId ?? session.id;

  async function handleSubmit({ rpe, duration }) {
    try {
      clearError();
      await logRpe(sessionId, {
        actualRpe: rpe,
        actualDurationMin: duration,
        teamId: session.team_id ?? null,
      });
      setLoggedRpe(rpe);
      setLoggedDuration(duration);
      setShowSelector(false);
      onRpeLogged?.();
    } catch {
      // error surfaced via hook
    }
  }

  return (
    <div>
      <p className="text-[15px] font-medium text-[var(--color-on-surface)]">{typeLabel}</p>
      {venueTime && (
        <p className="mt-1 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
          {venueTime}
        </p>
      )}

      {!started && (
        <span
          className="mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium"
          style={{
            background: 'color-mix(in srgb, var(--color-outline) 15%, var(--color-surface))',
            color: 'var(--color-text-tertiary)',
          }}
        >
          Upcoming
        </span>
      )}

      {started && loggedRpe == null && !showSelector && (
        <button
          type="button"
          onClick={() => setShowSelector(true)}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-black uppercase tracking-widest"
          style={{
            background: 'var(--color-primary-container)',
            color: 'var(--color-on-primary-container)',
          }}
        >
          Log RPE
        </button>
      )}

      {started && loggedRpe == null && showSelector && (
        <div className="mt-3">
          <SessionRpeInput
            key={sessionId}
            defaultRpe={session.rpe_planned ?? 5}
            defaultDuration={session.duration_planned ?? ''}
            submitting={saving}
            onSubmit={handleSubmit}
          />
          {error && (
            <button
              type="button"
              onClick={() => clearError()}
              className="mt-2 text-xs text-[var(--color-error)]"
            >
              Failed to save — tap to retry
            </button>
          )}
        </div>
      )}

      {loggedRpe != null && (
        <p
          className="mt-3 text-sm font-medium"
          style={{ color: 'var(--color-tertiary-container)' }}
        >
          RPE logged: {loggedRpe}
          {loggedDuration != null ? ` · ${loggedDuration} min` : ''}
        </p>
      )}
    </div>
  );
}

export function TodaySessionCard({ sessions, onRpeLogged }) {
  const items = sessions ?? [];

  return (
    <section className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">Today&apos;s session</p>
      {!items.length ? (
        <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">No session scheduled</p>
      ) : (
        <div className="mt-3 space-y-4">
          {items.map((session, index) => (
            <div key={session.sessionId ?? session.id ?? index}>
              {index > 0 && <div className="mb-4 border-t border-[var(--color-outline-variant)]" />}
              <TodaySessionItem session={session} onRpeLogged={onRpeLogged} />
            </div>
          ))}
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
