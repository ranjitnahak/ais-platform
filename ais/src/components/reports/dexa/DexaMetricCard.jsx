export default function DexaMetricCard({ label, value, unit, accentColor }) {
  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
      <p
        className="text-2xl font-black tabular-nums text-[var(--color-on-surface)]"
        style={accentColor ? { color: accentColor } : undefined}
      >
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-bold text-[var(--color-on-surface-variant)]">{unit}</span>
        ) : null}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </p>
    </div>
  );
}
