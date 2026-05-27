export function WellnessField({ item, value, onChange }) {
  const label = item.label;
  if (item.input_type === 'slider') {
    const current = value ?? midpoint(item);
    return (
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="text-sm font-black text-[var(--color-on-surface)]">{label}</label>
          <span className="text-3xl font-black text-[var(--color-primary)]">{current}</span>
        </div>
        <input
          type="range"
          min={item.scale_min}
          max={item.scale_max}
          step="0.5"
          value={current}
          onChange={(event) => onChange(item.key, Number(event.target.value))}
          className="h-10 w-full"
          style={{ accentColor: 'var(--color-primary)' }}
        />
        <div className="mt-1 flex justify-between text-[10px] font-bold text-[var(--color-outline)]">
          <span>{item.scale_min_label}</span>
          <span>{item.scale_max_label}</span>
        </div>
      </div>
    );
  }
  if (item.input_type === 'number') {
    return (
      <label className="block text-sm font-black text-[var(--color-on-surface)]">
        {label}
        <input
          type="number"
          value={value ?? ''}
          onChange={(event) => onChange(item.key, Number(event.target.value))}
          placeholder="Hours"
          className="mt-2 min-h-12 w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 text-base font-normal text-[var(--color-on-surface)] outline-none"
        />
      </label>
    );
  }
  if (item.input_type === 'radio') {
    return (
      <div>
        <p className="text-sm font-black text-[var(--color-on-surface)]">{label}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {getOptions(item).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(item.key, option)}
              className={`min-h-11 rounded-xl border px-4 text-xs font-black uppercase tracking-widest ${
                value === option
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
                  : 'border-[var(--color-outline-variant)] bg-[var(--color-surface)] text-[var(--color-on-surface-variant)]'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <label className="block text-sm font-black text-[var(--color-on-surface)]">
      {label}
      <input
        type="text"
        value={value ?? ''}
        onChange={(event) => onChange(item.key, event.target.value)}
        placeholder="Describe any areas of soreness"
        className="mt-2 min-h-12 w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 text-base font-normal text-[var(--color-on-surface)] outline-none"
      />
    </label>
  );
}

export function midpoint(item) {
  return (Number(item.scale_min ?? 0) + Number(item.scale_max ?? 5)) / 2;
}

function getOptions(item) {
  if (Array.isArray(item.options)) return item.options;
  try {
    return JSON.parse(item.options ?? '[]');
  } catch {
    return [];
  }
}

export function formatScore(score) {
  const value = Number(score);
  return Number.isNaN(value) ? '—' : value.toFixed(1);
}

export function getCompositeScore(items, responses) {
  const values = items
    .filter((item) => ['slider', 'number'].includes(item.input_type))
    .map((item) => {
      const value = Number(responses[item.key]);
      if (Number.isNaN(value)) return null;
      return item.direction === 'lower_better'
        ? Number(item.scale_max) - value + Number(item.scale_min)
        : value;
    })
    .filter((value) => value != null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
