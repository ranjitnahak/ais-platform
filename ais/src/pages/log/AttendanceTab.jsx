import { useCallback, useEffect, useState } from 'react';
import { canSync } from '../../lib/auth';
import { useUser } from '../../context/UserContext';
import { useSessionConfig } from '../../context/SessionConfigContext';
import { getEffectiveOrgId } from '../../lib/orgScope';
import { useAttendanceSessions } from '../../hooks/useAttendanceSessions';
import LogSkeleton from '../../components/shared/skeletons/LogSkeleton';
import AttendanceRoster from './AttendanceRoster';

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(isoDate, delta) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(isoDate) {
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

function formatTimeRange(start, end) {
  const startStr = start ? String(start).slice(0, 5) : '—';
  const endStr = end ? String(end).slice(0, 5) : '—';
  return `${startStr} – ${endStr}`;
}

function ToastBanner({ toast, onDismiss }) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div
      className={[
        'fixed bottom-24 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-bold',
        isError
          ? 'border border-[var(--color-error)] bg-[var(--color-surface-container-high)] text-[var(--color-error)]'
          : 'border border-[var(--color-primary-container)] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)]',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <span className="flex-1">{toast.message}</span>
        <button type="button" onClick={onDismiss} className="text-[var(--color-on-surface-variant)]">
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  );
}

export default function AttendanceTab() {
  const { user, activeTeamId, activeOrgId, availableTeams } = useUser();
  const { sessionTypeLabel } = useSessionConfig();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const canView = canSync(user, 'attendance', 'view') || Boolean(user?.isSuperuser);

  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [selectedSession, setSelectedSession] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setSelectedSession(null);
  }, [activeTeamId, effectiveOrgId, selectedDate]);

  const { sessions, loading, error } = useAttendanceSessions(selectedDate);

  const teamName =
    availableTeams?.find((t) => t.id === activeTeamId)?.name ?? 'Team';

  if (!canView) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center">
        <span className="material-symbols-outlined text-5xl text-[var(--color-outline)]">lock</span>
        <h2 className="mt-4 text-xl font-black text-[var(--color-on-surface)]">Attendance</h2>
        <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
          You need view permission on attendance to access this tab.
        </p>
      </div>
    );
  }

  if (selectedSession) {
    return (
      <>
        <AttendanceRoster
          session={selectedSession}
          teamName={teamName}
          onBack={() => setSelectedSession(null)}
          onToast={showToast}
        />
        <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-3">
        <button
          type="button"
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-outline-variant)] text-[var(--color-on-surface)]"
          aria-label="Previous day"
        >
          <span className="material-symbols-outlined text-lg">chevron_left</span>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">
            Session date
          </p>
          <p className="truncate text-sm font-bold text-[var(--color-on-surface)]">
            {formatDisplayDate(selectedDate)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-outline-variant)] text-[var(--color-on-surface)]"
          aria-label="Next day"
        >
          <span className="material-symbols-outlined text-lg">chevron_right</span>
        </button>
      </div>

      {!activeTeamId ? (
        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
          Select a team from the header to view sessions.
        </div>
      ) : loading ? (
        <LogSkeleton />
      ) : error ? (
        <div className="rounded-2xl border border-[var(--color-error)] bg-[var(--color-surface-container)] p-6 text-sm text-[var(--color-error)]">
          {error}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-[var(--color-outline)]">
            event_busy
          </span>
          <p className="mt-3 text-sm font-bold text-[var(--color-on-surface)]">No sessions</p>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            No sessions scheduled for {teamName} on this date.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => setSelectedSession(session)}
                className="w-full rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4 text-left transition-colors hover:bg-[var(--color-surface-container-high)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-[var(--color-on-surface)]">
                      {session.name || sessionTypeLabel(session.session_type) || 'Session'}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
                      {formatTimeRange(session.start_time, session.end_time)}
                    </p>
                  </div>
                  {session.plan_cell_id ? (
                    <span className="shrink-0 rounded-full border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
                      From weekly plan
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
