import { useCallback, useState } from 'react';
import { useUser } from '../../context/UserContext';
import { canSync } from '../../lib/auth';
import { exportAssessmentDashboardPDF } from '../../lib/exportAssessmentPDF';
import { useAssessmentDashboard } from '../../hooks/useAssessmentDashboard';
import { formatTestingDate } from '../../lib/trendEngine';
import AthleteProfileCard from '../../components/assessment/AthleteProfileCard';
import AssessmentFilterBar from '../../components/assessment/AssessmentFilterBar';
import CompositeClassificationCard from '../../components/assessment/CompositeClassificationCard';
import TrendChart from '../../components/assessment/TrendChart';
import ProgressionTable from '../../components/assessment/ProgressionTable';
import SquadTestMultiples from '../../components/assessment/SquadTestMultiples';
import MatrixView from '../../components/assessment/MatrixView';
import CoverageView from '../../components/assessment/CoverageView';
import TierLegend from '../../components/assessment/TierLegend';
import TierValue from '../../components/assessment/TierValue';

function DeltaRow({ delta, unit }) {
  if (delta == null) return null;
  const deltaClass =
    delta > 0
      ? 'text-[var(--color-excellent)]'
      : delta < 0
        ? 'text-[var(--color-error)]'
        : 'text-[var(--color-on-surface-variant)]';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const suffix = unit === 'seconds' || unit === 's' ? 's' : unit ? ` ${unit}` : '';

  return (
    <div className="mt-2 flex items-center gap-1">
      <span className={`text-sm font-black ${deltaClass}`}>
        {arrow} {delta > 0 ? '+' : ''}{delta.toFixed(2)}{suffix}
      </span>
    </div>
  );
}

export default function AssessmentDashboard() {
  const { user, availableTeams } = useUser();
  const canView = canSync(user, 'assessments', 'view');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const dashboard = useAssessmentDashboard();
  const {
    loading,
    error,
    filters,
    setFilter,
    navigateToIndividual,
    testingDates,
    tests,
    athletes,
    selectedTests,
    selectedTestingDates,
    athleteProfile,
    teamName,
    effectiveTeamId,
    individualProgressions,
    summaryCardDeltas,
    summaryCardPercentiles,
    compositeClassification,
    squadTestMultiples,
    matrixRows,
    dateScopeMode,
    dateScopeHint,
    tierFallbackFlags,
    allTierCrossings,
    benchmarkTiersByTest,
    coverageData,
  } = dashboard;

  const teamLogoUrl = availableTeams?.find((t) => t.id === effectiveTeamId)?.logo_url ?? null;

  const handleExportPDF = useCallback(async () => {
    if (exporting || loading) return;
    setExporting(true);
    setExportError(null);
    try {
      const mode = filters.viewMode === 'individual' ? 'athlete' : 'team';
      await exportAssessmentDashboardPDF({
        mode,
        user,
        teamLogoUrl,
        dashboard,
      });
    } catch (err) {
      console.error('[AssessmentDashboard] PDF export failed:', err);
      setExportError(err?.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [exporting, loading, filters.viewMode, user, teamLogoUrl, dashboard]);

  if (!canView) {
    return (
      <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
        You do not have permission to view assessment dashboards.
      </p>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-xl font-black tracking-tight text-[var(--color-on-surface)]">
          Assessment progression
        </h1>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          Track athlete and squad performance across testing dates
        </p>
      </div>

      <AssessmentFilterBar
        filters={filters}
        setFilter={setFilter}
        athletes={athletes}
        tests={tests}
        testingDates={testingDates}
        onExportPDF={handleExportPDF}
        exporting={exporting}
        exportError={exportError}
      />

      {!loading && filters.viewMode !== 'coverage' && <TierLegend />}

      {!loading &&
        (filters.viewMode === 'matrix' || filters.viewMode === 'squad') &&
        dateScopeHint && (
          <p className="text-xs text-[var(--color-on-surface-variant)]">{dateScopeHint}</p>
        )}

      {loading && (
        <p className="text-sm text-[var(--color-on-surface-variant)]">Loading assessment data…</p>
      )}
      {error && (
        <p className="rounded-xl border border-[var(--color-error)] bg-[var(--color-error-container)]/10 p-4 text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      {!loading && filters.viewMode === 'individual' && (
        <>
          {filters.athleteId && (
            <AthleteProfileCard
              athlete={athleteProfile}
              teamName={teamName}
              testingDatesCount={filters.sessionIds.length}
            />
          )}

          {filters.athleteId && selectedTests.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {selectedTests.map((test) => {
                const progression = individualProgressions[test.id];
                const lastPoint = progression?.dataPoints?.[progression.dataPoints.length - 1];
                const latestDelta = summaryCardDeltas[test.id];
                const percentile = summaryCardPercentiles[test.id];
                const unit = test.unit === 'seconds' ? 's' : test.unit;

                return (
                  <div
                    key={test.id}
                    className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4"
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                      {test.name}
                    </p>
                    <div className="mt-2">
                      <TierValue
                        mode="value-only"
                        value={lastPoint?.value ?? '—'}
                        tier={percentile?.tier ?? lastPoint?.tierName}
                        tierColor={percentile?.tierColor ?? lastPoint?.tierColor}
                        unit={unit}
                      />
                    </div>
                    {latestDelta?.hasPrevious && (
                      <DeltaRow delta={latestDelta.delta} unit={test.unit} />
                    )}
                  </div>
                );
              })}

              <CompositeClassificationCard compositeClassification={compositeClassification} />
            </div>
          )}

          {allTierCrossings.length > 0 && (
            <div className="rounded-2xl border border-[var(--color-outline-variant)] border-l-4 border-l-[var(--color-primary-container)] bg-[var(--color-surface-container)] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary-container)]">
                Tier crossings
              </p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--color-on-surface)]">
                {allTierCrossings.map((c, i) => (
                  <li key={`${c.testId}-${c.sessionId}-${i}`}>
                    {c.testName} crossed {c.fromTierName} → {c.toTierName} ({formatTestingDate(c.date)})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {filters.athleteId && selectedTests.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {selectedTests.map((test) => (
                <TrendChart
                  key={test.id}
                  test={test}
                  progression={individualProgressions[test.id]}
                  benchmarkTiers={benchmarkTiersByTest[test.id]}
                  showFallback={tierFallbackFlags[test.id]}
                  unit={test.unit}
                />
              ))}
            </div>
          )}

          {filters.athleteId && (
            <ProgressionTable
              selectedTests={selectedTests}
              selectedTestingDates={selectedTestingDates}
              individualProgressions={individualProgressions}
            />
          )}

          {!filters.athleteId && !loading && (
            <p className="text-center text-sm text-[var(--color-on-surface-variant)]">
              Select an athlete to view individual progression
            </p>
          )}
        </>
      )}

      {!loading && filters.viewMode === 'squad' && (
        dateScopeMode === 'empty' ? (
          <p className="text-center text-sm text-[var(--color-on-surface-variant)]">
            Select at least one testing date to view this table.
          </p>
        ) : (
          <SquadTestMultiples
            selectedTests={selectedTests}
            squadTestMultiples={squadTestMultiples}
            dateScopeMode={dateScopeMode}
          />
        )
      )}

      {!loading && filters.viewMode === 'matrix' && (
        dateScopeMode === 'empty' ? (
          <p className="text-center text-sm text-[var(--color-on-surface-variant)]">
            Select at least one testing date to view this table.
          </p>
        ) : (
          <MatrixView
            matrixRows={matrixRows}
            selectedTests={selectedTests}
            onCellClick={navigateToIndividual}
          />
        )
      )}

      {!loading && filters.viewMode === 'coverage' && (
        dateScopeMode === 'empty' || !selectedTests.length ? (
          <p className="text-center text-sm text-[var(--color-on-surface-variant)]">
            {dateScopeMode === 'empty'
              ? 'Select at least one testing date to view coverage.'
              : 'Select at least one test to view coverage.'}
          </p>
        ) : (
          <CoverageView
            coverageData={coverageData}
            selectedTests={selectedTests}
            selectedTestingDates={selectedTestingDates}
          />
        )
      )}
    </div>
  );
}
