import { TIER_COLORS } from '../../lib/chartColors';

const LEGEND_ITEMS = [
  { key: 'excellent', label: 'Excellent', color: TIER_COLORS.excellent },
  { key: 'aboveAverage', label: 'Above avg', color: TIER_COLORS.aboveAverage },
  { key: 'average', label: 'Average', color: TIER_COLORS.average },
  { key: 'belowAverage', label: 'Below avg', color: TIER_COLORS.belowAverage },
];

export default function TierLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-2">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.key} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
