import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { LOAD_MONITORING_CHART_COLORS, getLoadMonitoringChartOptions } from '../../lib/chartTheme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const REASON_LABELS = ['Sickness', 'Injury', 'Other'];
const REASON_KEYS = ['sickness', 'injury', 'other'];

export default function ReasonBreakdownChart({ reasonBreakdown, rangeLabel }) {
  const colors = useMemo(() => ({
    green: LOAD_MONITORING_CHART_COLORS.green,
    orange: LOAD_MONITORING_CHART_COLORS.orange,
    grey: LOAD_MONITORING_CHART_COLORS.grey,
    grid: LOAD_MONITORING_CHART_COLORS.grey,
    text: '#8E8E93',
    surface: LOAD_MONITORING_CHART_COLORS.surface,
  }), []);

  const total = (reasonBreakdown?.sickness ?? 0)
    + (reasonBreakdown?.injury ?? 0)
    + (reasonBreakdown?.other ?? 0);

  const { data, options } = useMemo(() => {
    const base = getLoadMonitoringChartOptions(colors);
    const values = REASON_KEYS.map((key) => reasonBreakdown?.[key] ?? 0);

    return {
      data: {
        labels: REASON_LABELS,
        datasets: [{
          label: 'Exceptions',
          data: values,
          backgroundColor: [colors.green, colors.orange, colors.grey],
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        ...base,
        indexAxis: 'y',
        scales: {
          x: {
            ...base.scales.x,
            beginAtZero: true,
            ticks: { ...base.scales.x.ticks, precision: 0 },
          },
          y: {
            ...base.scales.y,
            grid: { display: false },
          },
        },
      },
    };
  }, [reasonBreakdown, colors]);

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6 text-center text-sm text-[var(--color-on-surface-variant)]">
        No exception reasons recorded for {rangeLabel}.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">
        Reason breakdown — {rangeLabel}
      </h3>
      <div className="mt-3" style={{ height: 120 }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
