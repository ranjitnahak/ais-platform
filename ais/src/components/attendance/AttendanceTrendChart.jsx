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
import { getLoadMonitoringChartColors, getLoadMonitoringChartOptions } from '../../lib/chartTheme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

export default function AttendanceTrendChart({ weeklyTrend, rangeLabel }) {
  const colors = useMemo(() => getLoadMonitoringChartColors(), []);

  const { data, options } = useMemo(() => {
    const base = getLoadMonitoringChartOptions(colors);
    const labels = (weeklyTrend ?? []).map((week) => week.weekLabel);
    const values = (weeklyTrend ?? []).map((week) => week.attendanceRate);

    return {
      data: {
        labels,
        datasets: [{
          label: 'Attendance rate',
          data: values,
          borderColor: colors.blue,
          backgroundColor: 'rgba(10, 132, 255, 0.08)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: colors.blue,
          tension: 0.3,
          fill: true,
        }],
      },
      options: {
        ...base,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            ...base.scales.x,
            ticks: { ...base.scales.x.ticks, maxTicksLimit: 8, maxRotation: 0 },
          },
          y: {
            ...base.scales.y,
            min: 0,
            max: 100,
            ticks: {
              ...base.scales.y.ticks,
              callback: (value) => `${value}%`,
            },
            title: {
              display: true,
              text: 'Attendance %',
              color: colors.text,
              font: { size: 10 },
            },
          },
        },
        plugins: {
          ...base.plugins,
          tooltip: {
            ...base.plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                const value = ctx.parsed.y;
                return value == null ? 'No sessions' : `Attendance: ${value}%`;
              },
            },
          },
        },
      },
    };
  }, [weeklyTrend, colors]);

  if (!weeklyTrend?.length) {
    return (
      <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6 text-center text-sm text-[var(--color-on-surface-variant)]">
        No weekly attendance data for {rangeLabel}.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">
        Weekly attendance trend — {rangeLabel}
      </h3>
      <div className="mt-3" style={{ height: 150 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
