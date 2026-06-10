import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getLoadMonitoringChartColors, getLoadMonitoringChartOptions } from '../../../lib/chartTheme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function LoadBars({ dateLabels, dailyLoads, rangeLabel }) {
  const colors = useMemo(() => getLoadMonitoringChartColors(), []);

  const { data, options } = useMemo(() => {
    const base = getLoadMonitoringChartOptions(colors);
    const barColors = (dailyLoads ?? []).map((load) =>
      load > 0 ? colors.orange : 'rgba(249, 115, 22, 0.04)',
    );

    return {
      data: {
        labels: dateLabels,
        datasets: [{
          label: 'Session load',
          data: dailyLoads ?? [],
          backgroundColor: barColors,
          borderRadius: 2,
          borderSkipped: false,
        }],
      },
      options: {
        ...base,
        scales: {
          x: {
            ...base.scales.x,
            ticks: { ...base.scales.x.ticks, maxTicksLimit: 8, maxRotation: 0 },
          },
          y: {
            ...base.scales.y,
            beginAtZero: true,
            title: { display: false },
          },
        },
      },
    };
  }, [dateLabels, dailyLoads, colors]);

  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">
        Daily session load — {rangeLabel}
      </h3>
      <div className="mt-3" style={{ height: 110 }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
