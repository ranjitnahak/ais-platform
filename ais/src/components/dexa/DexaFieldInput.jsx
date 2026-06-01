const INPUT_CLASS =
  'min-h-10 w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)]';

export default function DexaFieldInput({
  label,
  fieldKey,
  value,
  type = 'text',
  isPopulated,
  isHighlighted,
  onChange,
}) {
  if (!isPopulated) {
    return (
      <div>
        {label ? (
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            {label}
          </span>
        ) : null}
        <div className="skeleton-bone min-h-10 w-full rounded-xl" aria-hidden />
      </div>
    );
  }

  const displayValue = value == null ? '' : String(value);

  return (
    <div>
      {label ? (
        <label
          htmlFor={fieldKey}
          className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]"
        >
          {label}
        </label>
      ) : null}
      <input
        id={fieldKey}
        type={type}
        value={displayValue}
        onChange={(event) => onChange(fieldKey, event.target.value)}
        className={`${INPUT_CLASS} ${isHighlighted ? 'border-[var(--color-primary-container)] ring-1 ring-[var(--color-primary-container)]' : ''}`}
      />
    </div>
  );
}
