import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { getLoadMonitoringChartColors, getLoadMonitoringChartOptions } from '../../../lib/chartTheme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

const THRESHOLD = 1.5;

export default function MonotonyChart({ weeklyMonotony }) {
  const colors = useMemo(() => getLoadMonitoringChartColors(), []);

  const labels = (weeklyMonotony ?? []).map((w) => w.label);
  const values = (weeklyMonotony ?? []).map((w) => w.monotony);
  const thresholdLine = labels.map(() => THRESHOLD);

  const { data, options } = useMemo(() => {
    const base = getLoadMonitoringChartOptions(colors);
    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Monotony',
            data: values,
            borderColor: colors.purple,
            backgroundColor: colors.purple,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: colors.purple,
            tension: 0.2,
          },
          {
            label: 'Threshold',
            data: thresholdLine,
            borderColor: colors.grey,
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [6, 4],
            pointRadius: 0,
          },
        ],
      },
      options: {
        ...base,
        scales: {
          x: {
            ...base.scales.x,
            ticks: { ...base.scales.x.ticks, maxRotation: 0 },
          },
          y: {
            ...base.scales.y,
            min: 0.5,
            max: 2.5,
          },
        },
      },
    };
  }, [labels, values, colors]);

  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">Weekly monotony</h3>
      <div className="mt-3" style={{ height: 110 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
