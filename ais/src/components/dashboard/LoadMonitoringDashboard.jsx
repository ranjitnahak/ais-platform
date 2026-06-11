import { useMemo, useRef } from 'react';
import { useUser } from '../../context/UserContext';
import { useLoadMonitoring } from '../../hooks/useLoadMonitoring';
import { getAcwrZone } from '../../lib/loadCalculations';
import { dashboardPdfFilename } from '../../lib/buildDashboardPDF';
import { useSessionConfig } from '../../context/SessionConfigContext';
import DashboardExportButton from '../shared/DashboardExportButton';
import DashboardPanelHeader from '../shared/DashboardPanelHeader';
import DashboardSkeleton from '../shared/skeletons/DashboardSkeleton';
import AcwrChart from './load-monitoring/AcwrChart';
import LoadBars from './load-monitoring/LoadBars';
import MonotonyChart from './load-monitoring/MonotonyChart';
import RpeComplianceCard from './load-monitoring/RpeComplianceCard';
import RpeDistributionCard from './load-monitoring/RpeDistributionCard';
import SquadTable from './load-monitoring/SquadTable';
import SpikeWarningBanner from './load-monitoring/SpikeWarningBanner';

const RANGE_OPTIONS = ['1W', '2W', '4W', '8W'];

const ZONE_CARD_TINT = {
  safe: 'border-[color-mix(in_srgb,var(--color-excellent)_30%,var(--color-outline-variant))] bg-[color-mix(in_srgb,var(--color-excellent)_8%,var(--color-surface-container))]',
  caution: 'border-[color-mix(in_srgb,var(--color-primary-container)_30%,var(--color-outline-variant))] bg-[color-mix(in_srgb,var(--color-primary-container)_8%,var(--color-surface-container))]',
  danger: 'border-[color-mix(in_srgb,var(--color-error-container)_30%,var(--color-outline-variant))] bg-[color-mix(in_srgb,var(--color-error-container)_8%,var(--color-surface-container))]',
};

const ZONE_BADGE = {
  safe: 'bg-[color-mix(in_srgb,var(--color-excellent)_25%,transparent)] text-[var(--color-excellent)]',
  caution: 'bg-[color-mix(in_srgb,var(--color-primary-container)_25%,transparent)] text-[var(--color-primary-container)]',
  danger: 'bg-[color-mix(in_srgb,var(--color-error-container)_25%,transparent)] text-[var(--color-error)]',
};

const ZONE_LABEL = { safe: 'Safe', caution: 'Caution', danger: 'Danger' };

function StatCard({ label, value, subtitle, zone }) {
  const tint = zone ? ZONE_CARD_TINT[zone] : 'border-[var(--color-outline-variant)] bg-[var(--color-surface)]';
  return (
    <div className={`rounded-2xl border p-4 ${tint}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-black text-[var(--color-on-surface)]">{value ?? '—'}</p>
        {zone && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${ZONE_BADGE[zone]}`}>
            {ZONE_LABEL[zone]}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-[10px] text-[var(--color-on-surface-variant)]">{subtitle}</p>
      )}
    </div>
  );
}

const selectClass = 'min-h-10 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-3 text-xs font-bold outline-none';

export default function LoadMonitoringDashboard() {
  const { user } = useUser();
  const { sessionTypes, sessionTypeLabel } = useSessionConfig();
  const exportRef = useRef(null);
  const {
    loading,
    error,
    filters,
    setFilter,
    athletes,
    statCards,
    dateLabels,
    dailyLoads,
    acwrSeries,
    weeklyMonotony,
    rpeCompliance,
    rpeDistribution,
    squadRows,
    spikeWarning,
    dataWarnings,
    isSquadView,
    rangeLabel,
    methodLabel,
  } = useLoadMonitoring();

  const acwrZone = getAcwrZone(statCards?.avgAcwr);
  const methodSubtitle = filters.method === 'ewma' ? 'AU · EWMA' : 'AU · Rolling avg';

  const sessionTypeOptions = sessionTypes.filter((o) => o.value !== 'other');

  const filterSnapshot = useMemo(() => {
    const athleteLabel = filters.athleteId
      ? athletes.find((a) => a.id === filters.athleteId)?.full_name ?? 'Athlete'
      : 'Squad view';
    const sessionLabel = filters.sessionType === 'all'
      ? 'All sessions'
      : sessionTypeLabel(filters.sessionType);
    const methodText = filters.method === 'ewma'
      ? 'EWMA λ = 2/(N+1)'
      : 'Rolling average 7d ÷ 28d mean';
    return `${filters.range} · ${athleteLabel} · ${sessionLabel} · ${methodText}`;
  }, [filters, athletes, sessionTypeLabel]);

  const exportFilename = dashboardPdfFilename({
    orgName: user?.orgName,
    dashboardSlug: 'load-monitoring-rpe',
  });

  return (
    <div ref={exportRef} className="mx-auto max-w-6xl space-y-6">
      <DashboardPanelHeader
        title="Load monitoring · RPE"
        subtitle={user?.orgName || '—'}
      >
        <DashboardExportButton
          exportRef={exportRef}
          filename={exportFilename}
          disabled={loading || !!error}
        />
      </DashboardPanelHeader>

      <p
        data-pdf-export-only
        className="hidden text-xs font-bold text-[var(--color-on-surface-variant)]"
      >
        {filterSnapshot}
      </p>

      <div data-pdf-exclude className="flex flex-wrap items-center gap-3 lg:ml-auto lg:justify-end">
        <div className="flex rounded-full border border-[var(--color-outline-variant)] p-0.5">
          {RANGE_OPTIONS.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setFilter('range', range)}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors ${
                filters.range === range
                  ? 'bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)]'
                  : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        <select
          value={filters.athleteId}
          onChange={(e) => setFilter('athleteId', e.target.value)}
          className={`${selectClass} min-w-[10rem]`}
          aria-label="Athlete view"
        >
          <option value="">Squad view</option>
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>{a.full_name}</option>
          ))}
        </select>
        <select
          value={filters.sessionType}
          onChange={(e) => setFilter('sessionType', e.target.value)}
          className={`${selectClass} min-w-[10rem]`}
          aria-label="Session type"
        >
          <option value="all">All sessions</option>
          {sessionTypeOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div data-pdf-exclude className="flex flex-col gap-3 border-t border-[var(--color-outline-variant)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">
            Calculation method
          </span>
          <button
            type="button"
            onClick={() => setFilter('method', 'ewma')}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
              filters.method === 'ewma'
                ? 'border-[rgba(255,255,255,0.2)] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)]'
                : 'border-transparent bg-transparent text-[var(--color-on-surface-variant)]'
            }`}
          >
            EWMA  λ = 2/(N+1)
          </button>
          <button
            type="button"
            onClick={() => setFilter('method', 'rolling')}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
              filters.method === 'rolling'
                ? 'border-[rgba(255,255,255,0.2)] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)]'
                : 'border-transparent bg-transparent text-[var(--color-on-surface-variant)]'
            }`}
          >
            Rolling average  7d ÷ 28d mean
          </button>
        </div>
        <p className="text-xs italic text-[var(--color-on-surface-variant)]">
          Switching recalculates all metrics and charts below.
        </p>
      </div>

      {dataWarnings?.length > 0 && (
        <div className="space-y-1">
          {dataWarnings.map((msg) => (
            <p key={msg} className="text-xs text-[var(--color-on-surface-variant)]">{msg}</p>
          ))}
        </div>
      )}

      {loading && <div data-pdf-exclude><DashboardSkeleton contentOnly /></div>}

      {error && (
        <p data-pdf-exclude className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface-container)] p-4 text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Avg ACWR"
              value={statCards?.avgAcwr?.toFixed(2)}
              zone={acwrZone}
            />
            <StatCard
              label="Acute load (7d)"
              value={statCards?.acute?.toLocaleString()}
              subtitle={methodSubtitle}
            />
            <StatCard
              label="Chronic load (28d)"
              value={statCards?.chronic?.toLocaleString()}
              subtitle={methodSubtitle}
            />
            <StatCard
              label="Monotony"
              value={statCards?.monotony?.toFixed(1)}
              subtitle="avg ÷ SD daily"
            />
            <StatCard
              label="Strain"
              value={statCards?.strain?.toLocaleString()}
              subtitle="weekly × monotony"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <RpeComplianceCard compliance={rpeCompliance} />
            <RpeDistributionCard distribution={rpeDistribution} />
          </section>

          <AcwrChart
            dateLabels={dateLabels}
            acwrSeries={acwrSeries}
            method={filters.method}
          />

          <section className="grid gap-4 lg:grid-cols-2">
            <LoadBars dateLabels={dateLabels} dailyLoads={dailyLoads} rangeLabel={rangeLabel} />
            <MonotonyChart weeklyMonotony={weeklyMonotony} />
          </section>

          <SpikeWarningBanner spikeWarning={spikeWarning} />

          {isSquadView && (
            <SquadTable rows={squadRows} methodLabel={methodLabel} rangeLabel={rangeLabel} />
          )}
        </>
      )}
    </div>
  );
}
