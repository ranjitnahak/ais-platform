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
import { EWMA_LAMBDA_ACUTE, EWMA_LAMBDA_CHRONIC } from '../../../lib/loadCalculations';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

export default function AcwrChart({ dateLabels, acwrSeries, method }) {
  const colors = useMemo(() => getLoadMonitoringChartColors(), []);

  const isEwma = method === 'ewma';
  const title = isEwma
    ? 'ACWR — EWMA model · acute 7d · chronic 28d'
    : 'ACWR — Rolling average model · acute 7d · chronic 28d';

  const footerNote = isEwma
    ? `EWMA active · λ acute=${EWMA_LAMBDA_ACUTE.toFixed(3)} · λ chronic=${EWMA_LAMBDA_CHRONIC.toFixed(3)}`
    : 'Rolling average active · acute 7d · chronic 28d mean';

  const { data, options } = useMemo(() => {
    const base = getLoadMonitoringChartOptions(colors);
    return {
      data: {
        labels: dateLabels,
        datasets: [
          {
            label: 'Acute',
            data: acwrSeries?.acute ?? [],
            borderColor: colors.blue,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            yAxisID: 'y',
            tension: 0.3,
          },
          {
            label: 'Chronic',
            data: acwrSeries?.chronic ?? [],
            borderColor: colors.grey,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            yAxisID: 'y',
            tension: 0.3,
          },
          {
            label: 'ACWR',
            data: acwrSeries?.acwr ?? [],
            borderColor: colors.orange,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 0,
            yAxisID: 'y1',
            tension: 0.3,
          },
        ],
      },
      options: {
        ...base,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            ...base.scales.x,
            ticks: { ...base.scales.x.ticks, maxTicksLimit: 7, maxRotation: 0 },
          },
          y: {
            ...base.scales.y,
            position: 'left',
            title: { display: true, text: 'Load (AU)', color: colors.text, font: { size: 10 } },
          },
          y1: {
            position: 'right',
            min: 0.5,
            max: 2.0,
            grid: { drawOnChartArea: false, color: colors.grid },
            ticks: { color: colors.text, font: { size: 10 } },
            title: { display: true, text: 'ACWR', color: colors.text, font: { size: 10 } },
          },
        },
      },
    };
  }, [dateLabels, acwrSeries, colors]);

  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
      <h3 className="text-sm font-black text-[var(--color-on-surface)]">{title}</h3>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-bold">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: colors.blue }} />
          Acute {isEwma ? 'EWMA' : '7d avg'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: colors.grey }} />
          Chronic {isEwma ? 'EWMA' : '28d avg'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: colors.orange }} />
          ACWR ratio
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          <span className="rounded px-2 py-0.5" style={{ backgroundColor: `color-mix(in srgb, ${colors.green} 25%, transparent)`, color: colors.green }}>
            Optimal 0.8–1.3
          </span>
          <span className="rounded px-2 py-0.5" style={{ backgroundColor: `color-mix(in srgb, ${colors.orange} 25%, transparent)`, color: colors.orange }}>
            Caution 1.3–1.5
          </span>
          <span className="rounded px-2 py-0.5" style={{ backgroundColor: `color-mix(in srgb, ${colors.red} 25%, transparent)`, color: colors.red }}>
            Danger &gt;1.5
          </span>
        </span>
      </div>
      <div className="mt-3" style={{ height: 150 }}>
        <Line data={data} options={options} />
      </div>
      <p className="mt-2 text-right text-xs italic text-[var(--color-on-surface-variant)]">{footerNote}</p>
    </div>
  );
}
