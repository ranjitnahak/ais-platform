import { useMemo, useRef } from 'react';
import { useUser } from '../../context/UserContext';
import { useLoadMonitoring } from '../../hooks/useLoadMonitoring';
import { getAcwrZone } from '../../lib/loadCalculations';
import { ZONE_BADGE } from '../../lib/zoneBadge';
import { dashboardPdfFilename } from '../../lib/buildDashboardPDF';
import { useSessionConfig } from '../../context/SessionConfigContext';
import DashboardExportButton from '../shared/DashboardExportButton';
import DashboardDateRangeFilter from '../shared/DashboardDateRangeFilter';
import DashboardPanelHeader from '../shared/DashboardPanelHeader';
import DashboardSkeleton from '../shared/skeletons/DashboardSkeleton';
import AcwrChart from './load-monitoring/AcwrChart';
import LoadBars from './load-monitoring/LoadBars';
import MonotonyChart from './load-monitoring/MonotonyChart';
import RPEComplianceBySession from './load-monitoring/RPEComplianceBySession';
import RpeDistributionCard from './load-monitoring/RpeDistributionCard';
import SquadTable from './load-monitoring/SquadTable';
import SpikeWarningBanner from './load-monitoring/SpikeWarningBanner';

const ZONE_CARD_TINT = {
  safe: 'border-[color-mix(in_srgb,var(--color-excellent)_30%,var(--color-outline-variant))] bg-[color-mix(in_srgb,var(--color-excellent)_8%,var(--color-surface-container))]',
  caution: 'border-[color-mix(in_srgb,var(--color-primary-container)_30%,var(--color-outline-variant))] bg-[color-mix(in_srgb,var(--color-primary-container)_8%,var(--color-surface-container))]',
  danger: 'border-[color-mix(in_srgb,var(--color-error-container)_30%,var(--color-outline-variant))] bg-[color-mix(in_srgb,var(--color-error-container)_8%,var(--color-surface-container))]',
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
    setRangeFilter,
    setCustomDateRange,
    dateRangeLabel,
    athletes,
    statCards,
    dateLabels,
    dailyLoads,
    acwrSeries,
    weeklyMonotony,
    rpeDistribution,
    squadRows,
    spikeWarning,
    dataWarnings,
    isSquadView,
    rangeLabel,
    methodLabel,
    dateFrom,
    dateTo,
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
    return `${rangeLabel} · ${dateRangeLabel} · ${athleteLabel} · ${sessionLabel} · ${methodText}`;
  }, [filters, athletes, sessionTypeLabel, rangeLabel, dateRangeLabel]);

  const exportFilename = dashboardPdfFilename({
    orgName: user?.orgName,
    dashboardSlug: 'load-monitoring-rpe',
  });

  return (
    <div ref={exportRef} className="mx-auto max-w-6xl space-y-6">
      <DashboardPanelHeader
        title="Load monitoring · RPE"
        subtitle={user?.orgName || '—'}
        exportSlot={(
          <DashboardExportButton
            exportRef={exportRef}
            filename={exportFilename}
            disabled={loading || !!error}
          />
        )}
      />

      <p
        data-pdf-export-only
        className="hidden text-xs font-bold text-[var(--color-on-surface-variant)]"
      >
        {filterSnapshot}
      </p>

      <div data-pdf-exclude className="flex flex-col items-end gap-3 lg:ml-auto">
        <DashboardDateRangeFilter
          range={filters.range}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          dateRangeLabel={dateRangeLabel}
          onRangeChange={setRangeFilter}
          onCustomDatesChange={setCustomDateRange}
        />
        <div className="flex flex-wrap items-center justify-end gap-3">
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
            <RPEComplianceBySession dateFrom={dateFrom} dateTo={dateTo} />
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
