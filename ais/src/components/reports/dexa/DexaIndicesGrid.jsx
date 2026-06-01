import { formatMetric } from '../../../lib/dexaInterpret';

function IndexRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-[var(--color-outline-variant)] py-2 last:border-b-0">
      <span className="text-xs text-[var(--color-on-surface-variant)]">{label}</span>
      <span className="text-sm font-bold tabular-nums text-[var(--color-on-surface)]">
        {formatMetric(value, 2)}
      </span>
    </div>
  );
}

export default function DexaIndicesGrid({ scan }) {
  if (!scan) return null;

  const left = [
    { label: 'Android/Gynoid Ratio', value: scan.android_gynoid_ratio },
    { label: 'VAT Mass (g)', value: scan.vat_mass_g },
    { label: 'VAT Area (cm²)', value: scan.vat_area_cm2 },
    { label: 'Fat Mass/Height²', value: scan.fat_mass_height2 },
  ];

  const right = [
    { label: 'Lean/Height²', value: scan.lean_height2 },
    { label: 'Appendicular Lean/Height²', value: scan.appen_lean_height2 },
    { label: 'Trunk/Limb Fat Ratio', value: scan.trunk_limb_fat_mass_ratio },
  ];

  return (
    <section className="space-y-3">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
        Adipose &amp; Lean Indices
      </h3>
      <div className="grid gap-4 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4 md:grid-cols-2">
        <div>
          {left.map((row) => (
            <IndexRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
        <div>
          {right.map((row) => (
            <IndexRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
      </div>
    </section>
  );
}
