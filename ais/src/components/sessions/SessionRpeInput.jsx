import { useState } from 'react';

const RPE_LABELS = [
  ['0', 'Rest'],
  ['5', 'Hard'],
  ['7', 'Very Hard'],
  ['10', 'Max'],
];

export default function SessionRpeInput({
  defaultRpe = 5,
  defaultDuration = '',
  disabled = false,
  submitting = false,
  onSubmit,
}) {
  const [rpe, setRpe] = useState(defaultRpe);
  const [duration, setDuration] = useState(
    defaultDuration === '' || defaultDuration == null ? '' : String(defaultDuration),
  );
  const [notes, setNotes] = useState('');

  async function handleSubmit() {
    if (!duration) return;
    await onSubmit({
      rpe: Number(rpe),
      duration: Number(duration),
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-widest text-[var(--color-outline)]">
            CR10 RPE
          </label>
          <span className="text-3xl font-black text-[var(--color-primary)]">{rpe}</span>
        </div>
        <input
          type="range"
          min="0"
          max="10"
          step="0.5"
          value={rpe}
          disabled={disabled || submitting}
          onChange={(e) => setRpe(e.target.value)}
          className="h-10 w-full"
          style={{ accentColor: 'var(--color-primary)' }}
        />
        <div className="mt-1 grid grid-cols-4 text-[10px] font-bold text-[var(--color-outline)]">
          {RPE_LABELS.map(([value, label]) => (
            <span key={value}>
              {value}={label}
            </span>
          ))}
        </div>
      </div>

      <input
        type="number"
        min="0"
        value={duration}
        disabled={disabled || submitting}
        onChange={(e) => setDuration(e.target.value)}
        placeholder="Duration in minutes"
        className="min-h-12 w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 text-base text-[var(--color-on-surface)] outline-none"
      />

      <textarea
        rows={2}
        value={notes}
        disabled={disabled || submitting}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-4 text-base text-[var(--color-on-surface)] outline-none"
      />

      <button
        type="button"
        disabled={disabled || submitting || !duration}
        onClick={handleSubmit}
        className="min-h-14 w-full rounded-xl bg-[var(--color-primary-container)] text-sm font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50"
      >
        {submitting ? 'Logging…' : 'Log session'}
      </button>
    </div>
  );
}
