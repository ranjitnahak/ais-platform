export default function SessionCreateRpeGrid({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="text-[11px] font-bold transition-colors"
            style={{
              width: 34,
              height: 30,
              borderRadius: 'var(--radius-md)',
              background: selected
                ? 'color-mix(in srgb, var(--color-primary-container) 25%, var(--color-surface))'
                : 'var(--color-surface-container)',
              border: selected
                ? '1px solid var(--color-primary-container)'
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
