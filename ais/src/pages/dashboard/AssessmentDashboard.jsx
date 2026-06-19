import { useCallback, useState } from 'react';
import { useUser } from '../../context/UserContext';
import { canSync } from '../../lib/auth';
import { exportAssessmentDashboardPDF } from '../../lib/exportAssessmentPDF';
import { useAssessmentDashboard } from '../../hooks/useAssessmentDashboard';
import { formatShortTestingDate, formatTestingDate } from '../../lib/trendEngine';
import AthleteProfileCard from '../../components/assessment/AthleteProfileCard';
import AssessmentFilterBar from '../../components/assessment/AssessmentFilterBar';
import CompositeClassificationCard from '../../components/assessment/CompositeClassificationCard';
import TrendChart from '../../components/assessment/TrendChart';
import ProgressionTable from '../../components/assessment/ProgressionTable';
import SquadComparisonChart from '../../components/assessment/SquadComparisonChart';
import SquadComparisonTable from '../../components/assessment/SquadComparisonTable';
import SquadTestMultiples from '../../components/assessment/SquadTestMultiples';

function TrendArrow({ direction }) {
  if (direction === 'improving') return <span className="text-[var(--color-excellent)]">↑</span>;
  if (direction === 'declining') return <span className="text-[var(--color-error)]">↓</span>;
  return <span className="text-[var(--color-on-surface-variant)]">→</span>;
}

function formatOrdinal(n) {
  if (n == null) return '';
  const rounded = Math.round(n);
  const mod10 = rounded % 10;
  const mod100 = rounded % 100;
  let suffix = 'th';
  if (mod10 === 1 && mod100 !== 11) suffix = 'st';
  else if (mod10 === 2 && mod100 !== 12) suffix = 'nd';
  else if (mod10 === 3 && mod100 !== 13) suffix = 'rd';
  return `${rounded}${suffix}`;
}

function formatLatestValue(points, unit) {
  const last = points?.[points.length - 1];
  if (!last) return '—';
  const suffix = unit === 'seconds' ? 's' : unit ? ` ${unit}` : '';
  const formatted = Number.isInteger(last.value) ? last.value : last.value.toFixed(2);
  return `${formatted}${suffix}`;
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
    testingDates,
    tests,
    athletes,
    selectedTests,
    selectedTestingDates,
    athleteProfile,
    teamName,
    effectiveTeamId,
    individualProgressions,
    summaryCardPercentiles,
    compositeClassification,
    squadProgression,
    squadTableRows,
    squadTestMultiples,
    tierFallbackFlags,
    allTierCrossings,
    benchmarkTiersByTest,
    testsById,
    allSessions,
  } = dashboard;

  const teamLogoUrl = availableTeams?.find((t) => t.id === effectiveTeamId)?.logo_url ?? null;

  const handleExportPDF = useCallback(async () => {
    if (exporting || loading) return;
    setExporting(true);
    setExportError(null);
    try {
      const mode = filters.viewMode === 'squad' ? 'team' : 'athlete';
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

  const sortedDates = selectedTestingDates;
  const firstDateLabel = sortedDates[0] ? formatShortTestingDate(sortedDates[0].assessed_on) : '';
  const lastDateLabel = sortedDates[sortedDates.length - 1]
    ? formatShortTestingDate(sortedDates[sortedDates.length - 1].assessed_on)
    : '';

  const squadTest = filters.testIds[0] ? testsById[filters.testIds[0]] : null;

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
                const delta = progression?.overallDelta;
                const percentile = summaryCardPercentiles[test.id];
                const deltaClass =
                  delta > 0
                    ? 'text-[var(--color-excellent)]'
                    : delta < 0
                      ? 'text-[var(--color-error)]'
                      : 'text-[var(--color-on-surface-variant)]';

                return (
                  <div
                    key={test.id}
                    className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4"
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                      {test.name}
                    </p>
                    <p className="mt-2 text-sm font-bold text-[var(--color-on-surface)]">
                      {formatLatestValue(progression?.dataPoints, test.unit)}
                      {percentile?.percentile != null && (
                        <span className="font-bold text-[var(--color-on-surface-variant)]">
                          {' '}
                          — {formatOrdinal(percentile.percentile)} percentile (team)
                        </span>
                      )}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-lg font-black ${deltaClass}`}>
                        {delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}` : '—'}
                      </span>
                      <TrendArrow direction={progression?.trendDirection} />
                    </div>
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
              testsById={testsById}
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
        <>
          <SquadComparisonChart
            squadProgression={squadProgression}
            test={squadTest}
            firstDateLabel={firstDateLabel}
            lastDateLabel={lastDateLabel}
          />
          <SquadComparisonTable squadRows={squadTableRows} test={squadTest} />
          <SquadTestMultiples
            tests={tests}
            squadTestMultiples={squadTestMultiples}
            allSessions={allSessions}
          />
        </>
      )}
    </div>
  );
}
