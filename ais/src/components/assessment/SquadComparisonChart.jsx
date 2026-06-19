import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getAssessmentChartColors, getAssessmentChartOptions } from '../../lib/chartTheme';
import { athleteDisplayName } from '../../lib/athleteName';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function SquadComparisonChart({
  squadProgression,
  test,
  firstDateLabel,
  lastDateLabel,
  colorLastBarByDelta = false,
  compact = false,
}) {
  const colors = useMemo(() => getAssessmentChartColors(), []);

  const { data, options } = useMemo(() => {
    const labels = squadProgression.map((row) =>
      athleteDisplayName(row.athlete ?? { full_name: row.athleteName }),
    );
    const base = getAssessmentChartOptions(colors);

    const lastBarColors = colorLastBarByDelta
      ? squadProgression.map((r) =>
          r.delta > 0 ? colors.excellent : r.delta < 0 ? colors.belowAvg : colors.avg,
        )
      : colors.line;

    return {
      data: {
        labels,
        datasets: [
          {
            label: firstDateLabel ?? 'First',
            data: squadProgression.map((r) => r.firstValue),
            backgroundColor: colors.aboveAvg,
            borderRadius: 4,
          },
          {
            label: lastDateLabel ?? 'Last',
            data: squadProgression.map((r) => r.lastValue),
            backgroundColor: lastBarColors,
            borderRadius: 4,
          },
        ],
      },
      options: {
        ...base,
        indexAxis: 'y',
        plugins: {
          ...base.plugins,
          legend: {
            display: true,
            labels: { color: colors.text, font: { size: 10, weight: 'bold' } },
          },
        },
        scales: {
          x: {
            ...base.scales.x,
            reverse: test?.direction === 'lower_is_better',
          },
          y: {
            ...base.scales.y,
            ticks: { ...base.scales.y.ticks, autoSkip: false, font: { size: 9 } },
          },
        },
      },
    };
  }, [squadProgression, colors, test, firstDateLabel, lastDateLabel, colorLastBarByDelta]);

  if (!squadProgression.length) {
    if (compact) return null;
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] text-sm text-[var(--color-on-surface-variant)]">
        No squad data for selected testing dates
      </div>
    );
  }

  const chartHeight = compact
    ? Math.max(200, squadProgression.length * 28)
    : Math.max(280, squadProgression.length * 36);

  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
      <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-[var(--color-on-surface)]">
        {compact ? test?.name : `Squad comparison — ${test?.name}`}
      </h3>
      <div style={{ height: chartHeight }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
