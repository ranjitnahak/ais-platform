import { useUser } from '../../context/UserContext';
import { canSync } from '../../lib/auth';
import { useAssessmentDashboard } from '../../hooks/useAssessmentDashboard';
import { formatShortTestingDate, formatTestingDate } from '../../lib/trendEngine';
import AthleteProfileCard from '../../components/assessment/AthleteProfileCard';
import AssessmentFilterBar from '../../components/assessment/AssessmentFilterBar';
import TrendChart from '../../components/assessment/TrendChart';
import ProgressionTable, { TierPill } from '../../components/assessment/ProgressionTable';
import SquadComparisonChart from '../../components/assessment/SquadComparisonChart';
import SquadComparisonTable from '../../components/assessment/SquadComparisonTable';

function TrendArrow({ direction }) {
  if (direction === 'improving') return <span className="text-[var(--color-excellent)]">↑</span>;
  if (direction === 'declining') return <span className="text-[var(--color-error)]">↓</span>;
  return <span className="text-[var(--color-on-surface-variant)]">→</span>;
}

function formatValueChain(points, unit) {
  if (!points?.length) return '—';
  const suffix = unit === 'seconds' ? 's' : unit ? ` ${unit}` : '';
  return points.map((p) => `${Number.isInteger(p.value) ? p.value : p.value.toFixed(2)}${suffix}`).join(' → ');
}

export default function AssessmentDashboard() {
  const { user } = useUser();
  const canView = canSync(user, 'assessments', 'view');

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
    individualProgressions,
    overallClassification,
    squadProgression,
    tierFallbackFlags,
    allTierCrossings,
    benchmarkTiersByTest,
    testsById,
  } = useAssessmentDashboard();

  if (!canView) {
    return (
      <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
        You do not have permission to view assessment dashboards.
      </p>
    );
  }

  const sortedDates = [...selectedTestingDates].sort(
    (a, b) => new Date(a.assessed_on) - new Date(b.assessed_on),
  );
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
                      {formatValueChain(progression?.dataPoints, test.unit)}
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

              {overallClassification && (
                <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                    Overall classification
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {overallClassification.progression
                      .filter((p) => p.medianPercentile != null)
                      .map((p) => (
                        <TierPill key={p.sessionId} tierName={p.tierName} tierColor={p.tierColor} />
                      ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <TrendArrow direction={overallClassification.trendDirection} />
                  </div>
                </div>
              )}
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
          <SquadComparisonTable squadProgression={squadProgression} test={squadTest} />
        </>
      )}
    </div>
  );
}
