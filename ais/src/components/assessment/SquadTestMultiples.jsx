import SquadComparisonChart from './SquadComparisonChart';
import { formatShortTestingDate } from '../../lib/trendEngine';

export default function SquadTestMultiples({ tests, squadTestMultiples, allSessions }) {
  if (!tests?.length) return null;

  const sessionLabel = (sessionId) => {
    const session = allSessions?.find((s) => s.id === sessionId);
    return session ? formatShortTestingDate(session.assessed_on) : '';
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tests.map((test) => {
        const progression = squadTestMultiples[test.id] ?? [];
        if (!progression.length) return null;

        const firstDateLabel = sessionLabel(progression[0]?.firstSessionId);
        const lastDateLabel = sessionLabel(progression[0]?.lastSessionId);

        return (
          <SquadComparisonChart
            key={test.id}
            squadProgression={progression}
            test={test}
            firstDateLabel={firstDateLabel}
            lastDateLabel={lastDateLabel}
            colorLastBarByDelta
            compact
          />
        );
      })}
    </div>
  );
}
