export default function SpikeWarningBanner({ spikeWarning }) {
  if (!spikeWarning) return null;

  const acwrText = spikeWarning.acwr != null ? spikeWarning.acwr.toFixed(2) : '—';
  const monotonyText = spikeWarning.monotony != null ? spikeWarning.monotony.toFixed(1) : '—';

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--color-primary-container)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-primary-container)_18%,var(--color-surface-container))] px-4 py-3">
      <span className="material-symbols-outlined shrink-0 text-[var(--color-primary-container)]" style={{ fontVariationSettings: "'FILL' 1" }}>
        warning
      </span>
      <p className="text-sm font-bold text-[var(--color-on-surface)]">
        {spikeWarning.name} — ACWR {acwrText} · Monotony {monotonyText}. High spike risk. Review session load before next intensity block.
      </p>
    </div>
  );
}
