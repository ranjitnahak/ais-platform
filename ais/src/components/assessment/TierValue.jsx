import { resolveTierHex, tierHexWithOpacity } from '../../lib/chartColors';

export function formatOrdinal(n) {
  if (n == null) return '';
  const rounded = Math.round(n);
  const mod10 = rounded % 10;
  const mod100 = rounded % 100;
  let suffix = 'th';
  if (mod10 === 1 && mod100 !== 11) suffix = 'st';
  else if (mod10 === 2 && mod100 !== 12) suffix = 'nd';
  else if (mod10 === 3 && mod100 !== 13) suffix = 'rd';
  return `${rounded}${suffix}`;
}

function formatDisplayValue(value, unit) {
  if (value == null || value === '—') return '—';
  if (typeof value === 'string') return value;
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (!unit) return formatted;
  return unit === 'seconds' || unit === 's' ? `${formatted}s` : `${formatted} ${unit}`;
}

export default function TierValue({
  value,
  percentile,
  tier,
  tierColor,
  mode = 'value-only',
  unit,
  className = '',
}) {
  const hex = resolveTierHex(tierColor);

  if (mode === 'pill') {
    if (percentile == null || !tier) {
      return (
        <span className={`text-sm text-[var(--color-on-surface-variant)] ${className}`}>—</span>
      );
    }
    return (
      <span
        className={`inline-block rounded-[20px] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${className}`}
        style={{
          color: hex,
          background: tierHexWithOpacity(hex, 0.18),
        }}
      >
        {formatOrdinal(percentile)} · {tier}
      </span>
    );
  }

  const display = formatDisplayValue(value, unit);
  return (
    <span
      className={`text-sm font-bold ${className}`}
      style={{ color: display === '—' ? undefined : hex }}
    >
      {display}
    </span>
  );
}
