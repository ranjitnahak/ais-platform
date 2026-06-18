import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  createTierBandPlugin,
  getAssessmentChartColors,
  getAssessmentChartOptions,
  tierColorVarToHex,
} from '../../lib/chartTheme';
import { formatShortTestingDate } from '../../lib/trendEngine';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function buildTierBands(benchmarkTiers, direction, colors) {
  const tiers = [...(benchmarkTiers ?? [])].sort((a, b) => a.tier_order - b.tier_order);
  if (!tiers.length) return [];

  return tiers
    .filter((t) => t.threshold_min != null || t.threshold_max != null)
    .map((tier) => ({
      min: tier.threshold_min ?? (direction === 'lower_is_better' ? 0 : tier.threshold_max * 0.5),
      max: tier.threshold_max ?? tier.threshold_min * 2,
      color: tierColorVarToHex(tier.tier_color, colors),
      label: tier.tier_name,
    }));
}

export default function TrendChart({
  test,
  progression,
  benchmarkTiers,
  showFallback,
  unit,
}) {
  const colors = useMemo(() => getAssessmentChartColors(), []);
  const direction = test?.direction ?? 'higher_is_better';
  const dataPoints = progression?.dataPoints ?? [];

  const tierBands = useMemo(
    () => buildTierBands(benchmarkTiers, direction, colors),
    [benchmarkTiers, direction, colors],
  );

  const tierBandPlugin = useMemo(
    () => createTierBandPlugin({ bands: tierBands }),
    [tierBands],
  );

  const { data, options } = useMemo(() => {
    const labels = dataPoints.map((p) => formatShortTestingDate(p.date));
    const values = dataPoints.map((p) => p.value);

    const base = getAssessmentChartOptions(colors);
    return {
      data: {
        labels,
        datasets: [
          {
            label: test?.name ?? 'Value',
            data: values,
            borderColor: colors.line,
            backgroundColor: colors.line,
            borderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.2,
          },
        ],
      },
      options: {
        ...base,
        plugins: {
          ...base.plugins,
          legend: { display: false },
          tooltip: {
            ...base.plugins.tooltip,
            callbacks: {
              label(context) {
                const point = dataPoints[context.dataIndex];
                if (!point) return '';
                const parts = [`${point.value}${unit ? ` ${unit}` : ''}`];
                if (point.tierName) parts.push(point.tierName);
                if (point.percentileRank != null) parts.push(`${point.percentileRank}%`);
                return parts.join(' · ');
              },
            },
          },
        },
        scales: {
          ...base.scales,
          y: {
            ...base.scales.y,
            reverse: direction === 'lower_is_better',
            title: {
              display: Boolean(unit),
              text: unit ?? '',
              color: colors.text,
              font: { size: 10 },
            },
          },
        },
      },
    };
  }, [dataPoints, test, colors, direction, unit]);

  if (!dataPoints.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] text-sm text-[var(--color-on-surface-variant)]">
        No data for selected testing dates
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-on-surface)]">
          {test?.name}
        </h3>
        {showFallback && (
          <span className="rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
            Team percentile fallback
          </span>
        )}
      </div>
      <div style={{ height: 220 }}>
        <Line data={data} options={options} plugins={[tierBandPlugin]} />
      </div>
    </div>
  );
}
