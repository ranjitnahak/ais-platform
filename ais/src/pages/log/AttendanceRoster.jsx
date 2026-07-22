import { useEffect, useRef, useState } from 'react';
import { athleteDisplayName, athleteInitialsFromAthlete } from '../../lib/athleteName';
import {
  ATTENDANCE_REASONS,
  formatExceptionSummary,
  isExceptionComplete,
} from '../../lib/attendanceRosterUi';
import { formatRelativeTime, useAttendanceRoster } from '../../hooks/useAttendanceRoster';
import { useSessionConfig } from '../../context/SessionConfigContext';
import LogSkeleton from '../../components/shared/skeletons/LogSkeleton';

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

function rowSnapshot(row) {
  return {
    status: row.status,
    reason: row.reason,
    informed: row.informed,
    note: row.note,
    recordId: row.recordId,
    markedAt: row.markedAt,
  };
}

function rowChanged(before, after) {
  if (!before || !after) return false;
  return (
    before.status !== after.status ||
    before.reason !== after.reason ||
    before.informed !== after.informed ||
    before.note !== after.note ||
    before.recordId !== after.recordId ||
    before.markedAt !== after.markedAt
  );
}

function SaveStatusIndicator({ saving, row }) {
  const [showSaved, setShowSaved] = useState(false);
  const snapshotRef = useRef(null);
  const prevSavingRef = useRef(false);

  useEffect(() => {
    if (saving && !prevSavingRef.current) {
      snapshotRef.current = rowSnapshot(row);
    }

    if (!saving && prevSavingRef.current) {
      const snap = snapshotRef.current;
      if (snap && rowChanged(snap, rowSnapshot(row))) {
        setShowSaved(true);
        const timer = window.setTimeout(() => setShowSaved(false), 1500);
        prevSavingRef.current = saving;
        return () => window.clearTimeout(timer);
      }
    }

    prevSavingRef.current = saving;
    return undefined;
  }, [saving, row]);

  if (saving) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-on-surface-variant)]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-primary)]" />
        Saving…
      </span>
    );
  }

  if (showSaved) {
    return (
      <span className="text-[10px] font-bold text-[var(--color-tertiary)]">Saved ✓</span>
    );
  }

  return null;
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

function ExceptionSummary({ row, onExpand }) {
  const styles = STATUS_STYLES[row.status];
  return (
    <button
      type="button"
      onClick={onExpand}
      className="mt-3 flex w-full items-center gap-2 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-container-highest)]"
    >
      <span
        className="min-w-0 flex-1 truncate text-xs font-bold"
        style={{ color: styles?.text }}
      >
        {formatExceptionSummary(row)}
      </span>
      <span className="material-symbols-outlined shrink-0 text-base text-[var(--color-on-surface-variant)]">
        chevron_right
      </span>
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

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] p-3">
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
          Reason
        </p>
        <div className="flex flex-wrap gap-2">
          {ATTENDANCE_REASONS.map((reason) => (
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
  isDetailsExpanded,
  onExpandDetails,
  onStatusChange,
  onPatch,
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const complete = isExceptionComplete(row);

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

  const showExceptionDetails =
    !readOnly && (row.status === 'late' || row.status === 'absent');

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
            <SaveStatusIndicator saving={saving} row={row} />
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

      {showExceptionDetails ? (
        isDetailsExpanded ? (
          <ReasonRow
            row={row}
            disabled={!canEdit}
            saving={saving}
            onChange={onPatch}
          />
        ) : complete ? (
          <ExceptionSummary row={row} onExpand={onExpandDetails} />
        ) : null
      ) : null}
    </li>
  );
}

export default function AttendanceRoster({ session, teamName, onBack, onToast }) {
  const { sessionTypeLabel } = useSessionConfig();
  const viewOpenedAtRef = useRef(Date.now());
  const prevSavingAthleteIdRef = useRef(null);
  const [activeExpandedAthleteId, setActiveExpandedAthleteId] = useState(null);
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

  useEffect(() => {
    const wasSaving = prevSavingAthleteIdRef.current;
    prevSavingAthleteIdRef.current = savingAthleteId;
    if (wasSaving && !savingAthleteId && activeExpandedAthleteId === wasSaving) {
      const row = rows.find((r) => r.athleteId === wasSaving);
      if (row && isExceptionComplete(row)) {
        setActiveExpandedAthleteId(null);
      }
    }
  }, [savingAthleteId, rows, activeExpandedAthleteId]);

  const handleStatusChange = (athleteId, status) => {
    if (status === 'present') {
      setActiveExpandedAthleteId((id) => (id === athleteId ? null : id));
      void saveAthleteStatus(athleteId, {
        status: 'present',
        reason: null,
        informed: null,
        note: null,
      });
      return;
    }
    setActiveExpandedAthleteId(athleteId);
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
              {session.name || sessionTypeLabel(session.session_type) || 'Session'}
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
              isDetailsExpanded={activeExpandedAthleteId === row.athleteId}
              onExpandDetails={() => setActiveExpandedAthleteId(row.athleteId)}
              onStatusChange={(status) => handleStatusChange(row.athleteId, status)}
              onPatch={(patch) => void saveAthleteStatus(row.athleteId, patch)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
