import BodyMapFigure from './BodyMapFigure';
import { parseLabelTranslations } from '../../lib/wellnessFormConstants';

export default function BodyMapSelector({
  label,
  labelTranslations,
  value = [],
  onChange,
  readOnly = false,
}) {
  const translations = typeof labelTranslations === 'object' ? labelTranslations : parseLabelTranslations(labelTranslations);
  const hindi = translations?.hi;

  function toggleRegion(regionId) {
    if (readOnly || !onChange) return;
    const next = value.includes(regionId)
      ? value.filter((id) => id !== regionId)
      : [...value, regionId];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-black text-[var(--color-on-surface)]">{label}</p>
        {hindi && (
          <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">{hindi}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        <div className="text-center">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]">Front</p>
          <BodyMapFigure view="front" value={value} onToggle={toggleRegion} readOnly={readOnly} />
        </div>
        <div className="text-center">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]">Back</p>
          <BodyMapFigure view="back" value={value} onToggle={toggleRegion} readOnly={readOnly} />
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]">Selected:</p>
        {value.length === 0 ? (
          <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">None</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {value.map((regionId) => (
              <span
                key={regionId}
                className="rounded-full bg-[var(--color-error-container)] px-2.5 py-1 text-[10px] font-bold text-[var(--color-error)]"
              >
                {regionId}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
