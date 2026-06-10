import { useState } from 'react';
import { useRPELog } from '../../hooks/useRPELog';
import { sessionTypeLabel } from '../../lib/sessionTypeStyles';
import SessionRpeInput from '../sessions/SessionRpeInput';
import LogSkeleton from '../shared/skeletons/LogSkeleton';

function formatSessionTime(startTime) {
  if (!startTime) return null;
  return String(startTime).slice(0, 5);
}

function sessionKey(session) {
  return session.id ?? session.sessionId;
}

export default function RPEEntryForm() {
  const { sessions, loading, submitting, error, submitted, submitRPELog } = useRPELog();
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [loggedSummary, setLoggedSummary] = useState(null);

  const selectedSession = sessions.find((session) => sessionKey(session) === selectedSessionId);

  async function handleSubmit(session, { rpe, duration, notes }) {
    const id = sessionKey(session);
    try {
      await submitRPELog({
        sessionId: id,
        actualRpe: rpe,
        actualDurationMin: duration,
        notes,
      });
      setLoggedSummary({ rpe, duration, sessionType: session.session_type });
    } catch (err) {
      console.error('[RPEEntryForm] submit failed:', err);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {loading && <LogSkeleton />}

      {!loading && !sessions.length && (
        <section className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6 text-center">
          <p className="font-bold text-[var(--color-on-surface)]">No sessions scheduled today</p>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
            Check back after your next scheduled session.
          </p>
        </section>
      )}

      {error && (
        <div className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface-container)] p-4 text-sm text-[var(--color-error)]">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-[var(--color-outline)]">
          Session RPE
        </h2>
        {sessions.map((session) => {
          const id = sessionKey(session);
          const isSelected = selectedSessionId === id;
          const title = sessionTypeLabel(session.session_type);
          const meta = [session.venue, formatSessionTime(session.start_time)].filter(Boolean).join(' · ');
          const alreadyLogged = session.actualRpe != null;

          return (
            <div
              key={id}
              className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4"
            >
              <button
                type="button"
                onClick={() => setSelectedSessionId(isSelected ? null : id)}
                className="flex min-h-16 w-full items-center justify-between gap-4 text-left"
              >
                <div>
                  <h3 className="text-lg font-black text-[var(--color-on-surface)]">{title}</h3>
                  {meta && (
                    <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">{meta}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {session.rpe_planned != null && (
                      <span className="text-xs font-bold text-[var(--color-outline)]">
                        Planned RPE: {session.rpe_planned}
                      </span>
                    )}
                    {alreadyLogged && (
                      <span
                        className="text-xs font-bold"
                        style={{ color: 'var(--color-tertiary-container)' }}
                      >
                        Logged: RPE {session.actualRpe}
                        {session.actualDurationMin != null ? ` · ${session.actualDurationMin} min` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <span className="material-symbols-outlined text-[var(--color-outline)]">
                  {isSelected ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {isSelected && (
                <div className="mt-5 border-t border-[var(--color-outline-variant)] pt-5">
                  <SessionRpeInput
                    key={id}
                    defaultRpe={session.rpe_planned ?? 5}
                    defaultDuration={session.duration_planned ?? session.actualDurationMin ?? ''}
                    submitting={submitting}
                    onSubmit={(payload) => handleSubmit(session, payload)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>

      {submitted && loggedSummary && selectedSession && (
        <section className="rounded-2xl bg-[var(--color-tertiary-container)] p-5 text-[var(--color-on-tertiary)]">
          <p className="text-sm font-black uppercase tracking-widest">Session logged ✓</p>
          <p className="mt-2 text-4xl font-black">RPE {loggedSummary.rpe}</p>
          <p className="mt-1 text-sm font-bold">
            {sessionTypeLabel(loggedSummary.sessionType)} · {loggedSummary.duration} min
          </p>
        </section>
      )}
    </div>
  );
}
