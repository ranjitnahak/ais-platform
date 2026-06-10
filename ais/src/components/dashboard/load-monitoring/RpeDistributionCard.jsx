import { LOAD_MONITORING_CHART_COLORS } from '../../../lib/chartTheme';

const BANDS = [
  { key: '1-3', label: '1–3', color: LOAD_MONITORING_CHART_COLORS.green },
  { key: '4-5', label: '4–5', color: LOAD_MONITORING_CHART_COLORS.green },
  { key: '6-7', label: '6–7', color: LOAD_MONITORING_CHART_COLORS.orange },
  { key: '8-9', label: '8–9', color: LOAD_MONITORING_CHART_COLORS.red },
  { key: '10', label: '10', color: LOAD_MONITORING_CHART_COLORS.red },
];

export default function RpeDistributionCard({ distribution }) {
  const bands = distribution?.bands ?? {};
  const total = distribution?.total ?? 0;
  const maxCount = Math.max(...BANDS.map((b) => bands[b.key] ?? 0), 1);

  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">RPE Distribution</h3>
        <span className="text-xs text-[var(--color-on-surface-variant)]">{total} responses</span>
      </div>
      <div className="mt-4 space-y-3">
        {BANDS.map((band) => {
          const count = bands[band.key] ?? 0;
          const widthPct = maxCount ? (count / maxCount) * 100 : 0;
          return (
            <div key={band.key} className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-xs font-bold text-[var(--color-on-surface-variant)]">{band.label}</span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-[var(--color-surface)]">
                <div
                  className="h-full rounded transition-all"
                  style={{ width: `${widthPct}%`, backgroundColor: band.color, minWidth: count > 0 ? '4px' : 0 }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs font-black text-[var(--color-on-surface)]">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
