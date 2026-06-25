export const ATTENDANCE_REASONS = [
  { value: 'sickness', label: 'Sickness' },
  { value: 'injury', label: 'Injury' },
  { value: 'other', label: 'Other' },
];

const REASON_LABELS = Object.fromEntries(
  ATTENDANCE_REASONS.map((r) => [r.value, r.label]),
);

export function isExceptionComplete(row) {
  return (
    (row.status === 'late' || row.status === 'absent') &&
    Boolean(row.reason) &&
    typeof row.informed === 'boolean'
  );
}

export function formatExceptionSummary(row) {
  const statusLabel = row.status === 'late' ? 'Late' : 'Absent';
  const reasonLabel = REASON_LABELS[row.reason] ?? row.reason ?? '—';
  const informedLabel =
    row.informed === true
      ? 'Informed in advance'
      : row.informed === false
        ? 'No notice given'
        : '—';

  const parts = [statusLabel, reasonLabel, informedLabel];
  const note = row.note?.trim();
  if (note) {
    parts.push(note.length > 40 ? `${note.slice(0, 40)}…` : note);
  }
  return parts.join(' · ');
}
