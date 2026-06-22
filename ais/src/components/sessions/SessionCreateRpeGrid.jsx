const RPE_LABELS = [
  ['0', 'Rest'],
  ['5', 'Hard'],
  ['7', 'Very Hard'],
  ['10', 'Max'],
];

const SLIDER_DEFAULT = 5;

function formatRpe(value) {
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function SessionCreateRpeGrid({ value, onChange }) {
  const sliderValue = value ?? SLIDER_DEFAULT;
  const displayValue = value == null ? '—' : formatRpe(value);

  function handleChange(event) {
    onChange(Number(event.target.value));
  }

  function handleClear() {
    onChange(null);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-2">
        {value != null && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] transition-colors hover:text-[var(--color-on-surface)]"
          >
            Clear
          </button>
        )}
        <span className="min-w-[2.5rem] text-right text-2xl font-black text-[var(--color-primary)]">
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        step="0.5"
        value={sliderValue}
        onChange={handleChange}
        className="h-10 w-full"
        style={{ accentColor: 'var(--color-primary)' }}
      />
      <div className="mt-1 grid grid-cols-4 text-[10px] font-bold text-[var(--color-outline)]">
        {RPE_LABELS.map(([anchor, label]) => (
          <span key={anchor}>
            {anchor}={label}
          </span>
        ))}
      </div>
    </div>
  );
}
