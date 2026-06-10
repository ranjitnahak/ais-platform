export default function InlineRpeSelector({ value, onSelect, disabled }) {
  return (
    <div className="mt-3 grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(n)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors disabled:opacity-50"
            style={{
              background: selected
                ? 'color-mix(in srgb, var(--color-primary-container) 25%, var(--color-surface))'
                : 'var(--color-surface-container)',
              border: selected
                ? '2px solid var(--color-primary-container)'
                : '1px solid var(--color-outline-variant)',
              color: selected ? 'var(--color-primary-container)' : 'var(--color-on-surface-variant)',
            }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
