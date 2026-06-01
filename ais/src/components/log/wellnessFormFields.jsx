import BodyMapSelector from '../shared/BodyMapSelector';
import { parseLabelTranslations, parseOptions, READINESS_COMPOSITE_EXCLUDED_KEYS } from '../../lib/wellnessFormConstants';

export function WellnessFieldLabel({ item }) {
  const translations = parseLabelTranslations(item.label_translations);
  return (
    <div className="mb-2">
      <p className="text-sm font-black text-[var(--color-on-surface)]">{item.label}</p>
      {translations.hi && (
        <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">{translations.hi}</p>
      )}
    </div>
  );
}

export function WellnessField({ item, value, onChange }) {
  if (item.input_type === 'body_map') {
    const regions = Array.isArray(value) ? value : [];
    return (
      <BodyMapSelector
        label={item.label}
        labelTranslations={item.label_translations}
        value={regions}
        onChange={(next) => onChange(item.key, next)}
      />
    );
  }

  if (item.input_type === 'slider') {
    const current = value ?? midpoint(item);
    const span = Number(item.scale_max) - Number(item.scale_min);
    const step = span > 5 ? 1 : 0.5;
    return (
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <WellnessFieldLabel item={item} />
          <span className="text-3xl font-black text-[var(--color-primary)]">
            {current}
            {item.key === 'sleep_hours' ? 'h' : ''}
          </span>
        </div>
        <input
          type="range"
          min={item.scale_min}
          max={item.scale_max}
          step={step}
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
      <label className="block">
        <WellnessFieldLabel item={item} />
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
    const options = parseOptions(item.options);
    return (
      <div>
        <WellnessFieldLabel item={item} />
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((option) => (
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
    <label className="block">
      <WellnessFieldLabel item={item} />
      <input
        type="text"
        value={value ?? ''}
        onChange={(event) => onChange(item.key, event.target.value)}
        className="mt-2 min-h-12 w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 text-base font-normal text-[var(--color-on-surface)] outline-none"
      />
    </label>
  );
}

export function midpoint(item) {
  return (Number(item.scale_min ?? 0) + Number(item.scale_max ?? 5)) / 2;
}

export function formatScore(score) {
  if (score == null) return '—';
  const value = Number(score);
  return Number.isNaN(value) ? '—' : value.toFixed(1);
}

/** Readiness composite: mean of 1–5 wellness sliders (excludes sleep_hours and non-slider fields). */
export function getCompositeScore(items, responses) {
  const values = items
    .filter(
      (item) =>
        item.input_type === 'slider' && !READINESS_COMPOSITE_EXCLUDED_KEYS.includes(item.key),
    )
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
