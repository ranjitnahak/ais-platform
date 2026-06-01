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
import { formatScanDate } from '../../../lib/dexaInterpret';
import { baseChartOptions, getDexaChartColors } from '../../../lib/chartTheme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function DexaTrendChart({ scans }) {
  const colors = useMemo(() => getDexaChartColors(), []);

  const { data, options } = useMemo(() => {
    const sorted = [...(scans ?? [])].sort(
      (a, b) => new Date(a.scan_date) - new Date(b.scan_date),
    );
    const labels = sorted.map((s) => formatScanDate(s.scan_date));

    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Total Body % Fat',
            data: sorted.map((s) => s.total_fat_pct ?? null),
            borderColor: colors.trendFat,
            backgroundColor: colors.trendFat,
            yAxisID: 'y',
            tension: 0.3,
          },
          {
            label: 'Lean/Height²',
            data: sorted.map((s) => s.lean_height2 ?? null),
            borderColor: colors.trendLean,
            backgroundColor: colors.trendLean,
            yAxisID: 'y1',
            tension: 0.3,
          },
        ],
      },
      options: {
        ...baseChartOptions(colors),
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: baseChartOptions(colors).scales.x,
          y: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: '% Fat',
              color: colors.text,
              font: { size: 10 },
            },
            ticks: { color: colors.text },
            grid: { color: colors.grid },
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Lean/Height²',
              color: colors.text,
              font: { size: 10 },
            },
            ticks: { color: colors.text },
            grid: { drawOnChartArea: false },
          },
        },
      },
    };
  }, [scans, colors]);

  if (!scans || scans.length < 2) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
        Body Composition Trend
      </h3>
      <div className="h-64 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
        <Line data={data} options={options} />
      </div>
    </section>
  );
}
