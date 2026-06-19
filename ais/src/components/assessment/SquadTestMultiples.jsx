import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { IMPROVEMENT_COLORS } from '../../lib/chartColors';
import { getAssessmentChartColors, getAssessmentChartOptions } from '../../lib/chartTheme';
import { athleteDisplayName } from '../../lib/athleteName';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

function ImprovementLegend() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: IMPROVEMENT_COLORS.improved }}
        />
        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
          Improved
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: IMPROVEMENT_COLORS.declined }}
        />
        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
          Declined
        </span>
      </div>
    </div>
  );
}

function DeltaChart({ test, progression }) {
  const colors = useMemo(() => getAssessmentChartColors(), []);

  const { data, options } = useMemo(() => {
    const labels = progression.map((row) =>
      athleteDisplayName(row.athlete ?? { full_name: row.athleteName }),
    );
    const base = getAssessmentChartOptions(colors);

    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Change',
            data: progression.map((r) => r.delta),
            backgroundColor: progression.map((r) =>
              r.delta > 0 ? IMPROVEMENT_COLORS.improved : IMPROVEMENT_COLORS.declined,
            ),
            borderRadius: 4,
          },
        ],
      },
      options: {
        ...base,
        indexAxis: 'y',
        plugins: {
          ...base.plugins,
          legend: { display: false },
        },
        scales: {
          x: base.scales.x,
          y: {
            ...base.scales.y,
            ticks: { ...base.scales.y.ticks, autoSkip: false, font: { size: 9 } },
          },
        },
      },
    };
  }, [progression, colors]);

  const chartHeight = Math.max(200, progression.length * 28);

  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-on-surface)]">
        {test?.name}
      </h3>
      <p className="mt-1 text-[10px] text-[var(--color-on-surface-variant)]">
        Change between each athlete&apos;s two most recent available test dates
      </p>
      <div className="mt-3" style={{ height: chartHeight }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}

export default function SquadTestMultiples({ selectedTests, squadTestMultiples }) {
  const charts = (selectedTests ?? []).filter(
    (test) => (squadTestMultiples[test.id] ?? []).length > 0,
  );

  if (!charts.length) {
    return (
      <p className="text-center text-sm text-[var(--color-on-surface-variant)]">
        No improvement data for selected tests
      </p>
    );
  }

  return (
    <div>
      <ImprovementLegend />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {charts.map((test) => (
          <DeltaChart
            key={test.id}
            test={test}
            progression={squadTestMultiples[test.id]}
          />
        ))}
      </div>
    </div>
  );
}
