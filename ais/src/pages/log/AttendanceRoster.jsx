import { useEffect, useRef, useState } from 'react';
import { athleteDisplayName, athleteInitialsFromAthlete } from '../../lib/athleteName';
import { formatRelativeTime, useAttendanceRoster } from '../../hooks/useAttendanceRoster';
import LogSkeleton from '../../components/shared/skeletons/LogSkeleton';

const REASONS = [
  { value: 'sickness', label: 'Sickness' },
  { value: 'injury', label: 'Injury' },
  { value: 'other', label: 'Other' },
];

const STATUS_STYLES = {
  present: {
    text: 'var(--color-text-success)',
    bg: 'var(--color-background-success)',
    border: 'var(--color-tertiary-container)',
  },
  late: {
    text: 'var(--color-text-warning)',
    bg: 'var(--color-background-warning)',
    border: 'var(--color-primary-container)',
  },
  absent: {
    text: 'var(--color-text-danger)',
    bg: 'var(--color-background-danger)',
    border: 'var(--color-error-container)',
  },
};

function formatSessionDate(iso) {
  return String(iso ?? '').slice(0, 10);
}

function formatTimeRange(start, end) {
  const startStr = start ? String(start).slice(0, 5) : '—';
  const endStr = end ? String(end).slice(0, 5) : '—';
  return `${startStr} – ${endStr}`;
}

function StatusChip({ label, active, statusKey, disabled, onClick }) {
  const styles = STATUS_STYLES[statusKey];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        active ? 'border-transparent' : 'border-[var(--color-outline-variant)] bg-transparent text-[var(--color-on-surface-variant)]',
      ].join(' ')}
      style={
        active
          ? {
              color: styles.text,
              background: styles.bg,
              borderColor: styles.border,
            }
          : undefined
      }
    >
      {label}
    </button>
  );
}

function ReasonRow({ row, disabled, saving, onChange }) {
  const [noteOpen, setNoteOpen] = useState(Boolean(row.note));
  const [noteDraft, setNoteDraft] = useState(row.note ?? '');

  useEffect(() => {
    if (row.note) {
      setNoteOpen(true);
      setNoteDraft(row.note);
    }
  }, [row.note]);

  const commitNote = () => {
    if ((row.note ?? '') !== noteDraft) {
      onChange({ note: noteDraft });
    }
  };

  if (row.status !== 'late' && row.status !== 'absent') return null;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] p-3">
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
          Reason
        </p>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((reason) => (
            <button
              key={reason.value}
              type="button"
              disabled={disabled || saving}
              onClick={() => onChange({ reason: reason.value })}
              className={[
                'rounded-full border px-3 py-1 text-xs font-bold',
                row.reason === reason.value
                  ? 'border-[var(--color-primary-container)] bg-[var(--color-background-warning)] text-[var(--color-text-warning)]'
                  : 'border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)]',
              ].join(' ')}
            >
              {reason.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
          Informed
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => onChange({ informed: true })}
            className={[
              'rounded-full border px-3 py-1 text-xs font-bold',
              row.informed === true
                ? 'border-[var(--color-tertiary-container)] bg-[var(--color-background-success)] text-[var(--color-text-success)]'
                : 'border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)]',
            ].join(' ')}
          >
            Informed in advance
          </button>
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => onChange({ informed: false })}
            className={[
              'rounded-full border px-3 py-1 text-xs font-bold',
              row.informed === false
                ? 'border-[var(--color-primary-container)] bg-[var(--color-background-warning)] text-[var(--color-text-warning)]'
                : 'border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)]',
            ].join(' ')}
          >
            No notice given
          </button>
        </div>
      </div>

      {noteOpen ? (
        <input
          type="text"
          disabled={disabled || saving}
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={commitNote}
          placeholder="Optional note"
          className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary-container)]"
        />
      ) : (
        <button
          type="button"
          disabled={disabled || saving}
          onClick={() => setNoteOpen(true)}
          className="text-xs font-bold text-[var(--color-primary)]"
        >
          + Add note
        </button>
      )}
    </div>
  );
}

function AthleteRow({
  row,
  readOnly,
  canEdit,
  saving,
  viewOpenedAt,
  onStatusChange,
  onPatch,
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const athlete = {
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: row.full_name,
  };
  const showEdited =
    row.recordId &&
    row.markedAt &&
    new Date(row.markedAt).getTime() < viewOpenedAt - 5 * 60 * 1000;

  const statusLabel =
    row.status === 'late' ? 'Late' : row.status === 'absent' ? 'Absent' : 'Present';

  return (
    <li className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-container-high)] text-sm font-black text-[var(--color-primary)]">
          {athleteInitialsFromAthlete(athlete)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--color-on-surface)]">
            {athleteDisplayName(athlete)}
          </p>
        </div>

        {readOnly ? (
          <span
            className="rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{
              color: STATUS_STYLES[row.status]?.text,
              background: STATUS_STYLES[row.status]?.bg,
            }}
          >
            {statusLabel}
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            {showEdited ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTooltipOpen((v) => !v)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)]"
                  aria-label="Edited attendance"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                </button>
                {tooltipOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-highest)] p-2 text-xs text-[var(--color-on-surface)] shadow-lg">
                    Changed to {row.status} by {row.markedByName || 'Unknown'},{' '}
                    {formatRelativeTime(row.markedAt)}
                  </div>
                ) : null}
              </div>
            ) : null}
            <StatusChip
              label="Present"
              statusKey="present"
              active={row.status === 'present'}
              disabled={saving || !canEdit}
              onClick={() => onStatusChange('present')}
            />
            <StatusChip
              label="Late"
              statusKey="late"
              active={row.status === 'late'}
              disabled={saving || !canEdit}
              onClick={() => onStatusChange('late')}
            />
            <StatusChip
              label="Absent"
              statusKey="absent"
              active={row.status === 'absent'}
              disabled={saving || !canEdit}
              onClick={() => onStatusChange('absent')}
            />
          </div>
        )}
      </div>

      {!readOnly ? (
        <ReasonRow
          row={row}
          disabled={!canEdit}
          saving={saving}
          onChange={onPatch}
        />
      ) : null}
    </li>
  );
}

export default function AttendanceRoster({ session, teamName, onBack, onToast }) {
  const viewOpenedAtRef = useRef(Date.now());
  const {
    rows,
    loading,
    canEdit,
    readOnly,
    savingAthleteId,
    resetting,
    exceptionCount,
    withoutNoticeCount,
    saveAthleteStatus,
    resetAll,
  } = useAttendanceRoster(session, { onToast });

  const handleStatusChange = (athleteId, status) => {
    if (status === 'present') {
      void saveAthleteStatus(athleteId, {
        status: 'present',
        reason: null,
        informed: null,
        note: null,
      });
      return;
    }
    void saveAthleteStatus(athleteId, { status });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-outline-variant)] text-[var(--color-on-surface)]"
            aria-label="Back to sessions"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-black text-[var(--color-on-surface)]">
              {session.name || 'Session'}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
              {formatSessionDate(session.session_date)} · {teamName} ·{' '}
              {formatTimeRange(session.start_time, session.end_time)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[var(--color-on-surface-variant)]">
                {exceptionCount} marked late or absent
              </span>
              {withoutNoticeCount > 0 ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    color: 'var(--color-text-warning)',
                    background: 'var(--color-background-warning)',
                  }}
                >
                  {withoutNoticeCount} without notice
                </span>
              ) : null}
            </div>
          </div>
          {!readOnly ? (
            <button
              type="button"
              disabled={!canEdit || exceptionCount === 0 || resetting}
              onClick={() => void resetAll()}
              className="shrink-0 rounded-lg border border-[var(--color-outline-variant)] px-3 py-1.5 text-xs font-bold text-[var(--color-on-surface)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset all
            </button>
          ) : null}
        </div>

        {!readOnly && !canEdit ? (
          <p className="mt-3 text-xs text-[var(--color-text-warning)]">
            Editing closed after 48 hours. Contact an admin to make changes.
          </p>
        ) : null}
      </div>

      {loading ? (
        <LogSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
          No athletes on roster for this session.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <AthleteRow
              key={row.athleteId}
              row={row}
              readOnly={readOnly}
              canEdit={canEdit}
              saving={savingAthleteId === row.athleteId}
              viewOpenedAt={viewOpenedAtRef.current}
              onStatusChange={(status) => handleStatusChange(row.athleteId, status)}
              onPatch={(patch) => void saveAthleteStatus(row.athleteId, patch)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
