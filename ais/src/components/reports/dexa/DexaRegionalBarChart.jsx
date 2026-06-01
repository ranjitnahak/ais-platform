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
import { DEXA_REGIONAL_ROWS } from '../../../lib/dexaFieldConfig';
import { baseChartOptions, getDexaChartColors } from '../../../lib/chartTheme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function DexaRegionalBarChart({ scan }) {
  const colors = useMemo(() => getDexaChartColors(), []);

  const { data, options } = useMemo(() => {
    const labels = DEXA_REGIONAL_ROWS.map((r) => r.label);
    const fatData = DEXA_REGIONAL_ROWS.map((r) => Number(scan?.[r.fat]) || 0);
    const leanData = DEXA_REGIONAL_ROWS.map((r) => Number(scan?.[r.lean]) || 0);

    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Fat (g)',
            data: fatData,
            backgroundColor: colors.fat,
            borderRadius: 4,
          },
          {
            label: 'Lean (g)',
            data: leanData,
            backgroundColor: colors.lean,
            borderRadius: 4,
          },
        ],
      },
      options: {
        ...baseChartOptions(colors),
        plugins: {
          ...baseChartOptions(colors).plugins,
          legend: { position: 'top' },
        },
        scales: {
          x: {
            ...baseChartOptions(colors).scales.x,
            stacked: false,
          },
          y: {
            ...baseChartOptions(colors).scales.y,
            title: {
              display: true,
              text: 'Mass (g)',
              color: colors.text,
              font: { size: 10 },
            },
          },
        },
      },
    };
  }, [scan, colors]);

  if (!scan) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
        Regional Body Composition
      </h3>
      <div className="h-64 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
        <Bar data={data} options={options} />
      </div>
    </section>
  );
}
