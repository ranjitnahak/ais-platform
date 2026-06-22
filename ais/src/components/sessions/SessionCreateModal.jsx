import { useEffect } from 'react';
import { useSessionCreate } from '../../hooks/useSessionCreate';
import SessionCreateRpeGrid from './SessionCreateRpeGrid';
import SessionCreateAthleteRoster from './SessionCreateAthleteRoster';

const fieldClass =
  'w-full rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-3 py-2 text-sm text-[var(--color-on-surface)] outline-none';
const labelClass = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]';

export default function SessionCreateModal({ open, slot, session, planId, defaultTeamId, onClose, onSaved }) {
  const create = useSessionCreate({ planId, defaultTeamId });
  const isEdit = Boolean(session) || create.isEditMode;

  useEffect(() => {
    if (!open) return;
    if (session) {
      void create.initFromSession(session);
    } else if (slot) {
      create.initFromSlot(slot);
    }
  }, [open, session?.id, slot?.date, slot?.startTime]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!create.toast) return undefined;
    const timer = window.setTimeout(() => create.dismissToast(), 4000);
    return () => window.clearTimeout(timer);
  }, [create.toast, create.dismissToast]);

  if (!open || (!slot && !session)) return null;

  async function handleSave() {
    try {
      await create.saveSession();
      onSaved?.();
      onClose();
    } catch {
      // error surfaced via hook
    }
  }

  const dateIso = session?.session_date ?? slot?.date;
  const dayLabel = new Date(dateIso + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeLabel = isEdit ? create.startTime : null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: 'rgba(0, 0, 0, 0.55)' }}
        onClick={onClose}
        role="presentation"
      />
      <div
        className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-create-title"
      >
        <div
          className="pointer-events-auto flex max-h-[90vh] w-[480px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-outline-variant)] shadow-2xl"
          style={{ background: 'var(--color-surface)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--color-outline-variant)] px-5 py-4">
            <div>
              <h2 id="session-create-title" className="text-lg font-black text-[var(--color-on-surface)]">
                {isEdit ? 'Edit session' : 'New session'}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">
                {dayLabel}
                {timeLabel ? ` · ${timeLabel}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--color-outline)] hover:text-[var(--color-on-surface)]"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="session-start-time">
                  Start time
                </label>
                <input
                  id="session-start-time"
                  type="text"
                  value={create.startTime}
                  onChange={(e) => create.setStartTime(e.target.value)}
                  placeholder="06:30"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="session-end-time">
                  End time
                </label>
                <input
                  id="session-end-time"
                  type="text"
                  value={create.endTime}
                  onChange={(e) => create.setEndTime(e.target.value)}
                  placeholder="08:00"
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="session-type">
                Session type
              </label>
              <select
                id="session-type"
                value={create.sessionType}
                onChange={(e) => create.setSessionType(e.target.value)}
                className={fieldClass}
              >
                {create.sessionTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="session-venue">
                Venue
              </label>
              <select
                id="session-venue"
                value={create.venue}
                onChange={(e) => create.setVenue(e.target.value)}
                className={fieldClass}
              >
                {create.venueOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="duration-planned">
                  Planned duration (min)
                </label>
                <input
                  id="duration-planned"
                  type="number"
                  min={1}
                  value={create.durationPlanned}
                  onChange={(e) => create.setDurationPlanned(Number(e.target.value))}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="duration-actual">
                  Actual duration (min)
                </label>
                <input
                  id="duration-actual"
                  type="number"
                  min={1}
                  value={create.durationActual}
                  onChange={(e) => create.setDurationActual(e.target.value)}
                  placeholder="—"
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <p className={labelClass}>RPE planned</p>
              <SessionCreateRpeGrid value={create.rpePlanned} onChange={create.setRpePlanned} />
            </div>

            {isEdit && (
              <div>
                <label className={labelClass} htmlFor="rpe-actual">
                  RPE actual
                </label>
                <input
                  id="rpe-actual"
                  type="number"
                  min={1}
                  max={10}
                  value={create.rpeActual}
                  onChange={(e) => create.setRpeActual(e.target.value)}
                  placeholder="—"
                  className={fieldClass}
                />
              </div>
            )}

            <div>
              <p className={labelClass}>Team</p>
              {create.teamsLoading ? (
                <p className="text-xs text-[var(--color-outline)]">Loading teams…</p>
              ) : (
                <div className="space-y-1.5">
                  {create.teams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => create.selectTeam(team.id)}
                      className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                      style={{
                        borderColor:
                          create.selectedTeamId === team.id
                            ? 'var(--color-primary-container)'
                            : 'var(--color-outline-variant)',
                        background:
                          create.selectedTeamId === team.id
                            ? 'color-mix(in srgb, var(--color-primary-container) 12%, var(--color-surface))'
                            : 'var(--color-surface-container)',
                        color: 'var(--color-on-surface)',
                      }}
                    >
                      <span>{team.name}</span>
                      <span className="text-[10px] text-[var(--color-outline)]">
                        {team.athleteCount} athletes
                      </span>
                    </button>
                  ))}
                  {!create.teams.length && (
                    <p className="text-xs text-[var(--color-outline)]">No teams available.</p>
                  )}
                </div>
              )}
            </div>

            {create.selectedTeamId && (
              <div>
                <p className={labelClass}>Athlete roster</p>
                <SessionCreateAthleteRoster
                  athletes={create.athletes}
                  includedAthleteIds={create.includedAthleteIds}
                  includedCount={create.includedCount}
                  totalAthletes={create.totalAthletes}
                  loading={create.rosterLoading}
                  onToggle={create.toggleAthlete}
                  onDeselectAll={create.deselectAllAthletes}
                />
              </div>
            )}

            <div>
              <label className={labelClass} htmlFor="session-notes">
                Notes
              </label>
              <textarea
                id="session-notes"
                rows={3}
                value={create.notes}
                onChange={(e) => create.setNotes(e.target.value)}
                placeholder="Add notes..."
                className={fieldClass}
              />
            </div>

            {create.includedCount > 0 && (
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: create.rosterPersisted
                    ? 'color-mix(in srgb, var(--color-tertiary-container) 15%, var(--color-surface))'
                    : 'color-mix(in srgb, var(--color-primary-container) 15%, var(--color-surface))',
                  color: create.rosterPersisted
                    ? 'var(--color-tertiary-fixed-dim)'
                    : 'var(--color-on-primary-container)',
                  border: create.rosterPersisted
                    ? '1px solid color-mix(in srgb, var(--color-tertiary-container) 40%, transparent)'
                    : '1px solid color-mix(in srgb, var(--color-primary-container) 40%, transparent)',
                }}
              >
                {create.rosterPersisted
                  ? `${create.includedCount} athlete${create.includedCount === 1 ? '' : 's'} will be prompted to log RPE on their dashboard after this session.`
                  : `Save changes to assign ${create.includedCount} athlete${create.includedCount === 1 ? '' : 's'} — they will not see this session on their dashboard until you save.`}
              </div>
            )}

            <button
              type="button"
              disabled
              className="flex w-full items-center justify-between rounded-lg border border-[var(--color-outline-variant)] px-3 py-2 text-left text-xs"
              style={{ opacity: 0.35, cursor: 'not-allowed' }}
            >
              <span className="text-[var(--color-on-surface-variant)]">Plan this session in S&amp;C Pro →</span>
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase"
                style={{
                  background: 'var(--color-surface-container-high)',
                  color: 'var(--color-outline)',
                }}
              >
                Coming in V2
              </span>
            </button>

            {create.error && (
              <p className="text-sm text-[var(--color-error)]">{create.error}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--color-outline-variant)] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={create.saving || !create.selectedTeamId}
              onClick={handleSave}
              className="rounded-lg px-5 py-2.5 text-xs font-black uppercase tracking-widest disabled:opacity-50"
              style={{
                background: 'var(--color-primary-container)',
                color: 'var(--color-on-primary-container)',
              }}
            >
              {create.saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save session'}
            </button>
          </div>
        </div>
      </div>

      {create.toast && (
        <div
          className="fixed bottom-6 right-6 z-[200] max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg"
          style={{
            background: 'var(--color-surface-container-high)',
            color: 'var(--color-on-surface)',
            border: '1px solid var(--color-outline-variant)',
          }}
        >
          {create.toast.message}
        </div>
      )}
    </>
  );
}
