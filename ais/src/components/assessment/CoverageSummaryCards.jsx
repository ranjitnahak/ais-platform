import { useState } from 'react';
import { formatShortTestingDate } from '../../lib/trendEngine';
import { athleteDisplayName } from '../../lib/athleteName';

function CoverageProgressMetric({ label, count, total }) {
  const pct = total ? (count / total) * 100 : 0;

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
          {label}
        </p>
        <p className="text-sm font-black text-[var(--color-on-surface)]">
          {count}/{total}
        </p>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface)]">
        <div
          className="h-full rounded-full bg-[var(--color-primary-container)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MissingAthletesRow({ summary }) {
  const { session, missingAthletes, squadSize } = summary;
  const [expanded, setExpanded] = useState(false);
  const dateLabel = formatShortTestingDate(session.assessed_on);
  const missingCount = missingAthletes.length;

  if (missingCount === 0) return null;

  return (
    <div
      className={`rounded-2xl border ${
        expanded
          ? 'border-[var(--color-primary)] bg-[var(--color-surface)]'
          : 'border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)]'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-12 w-full items-center gap-3 p-3 text-left"
      >
        <span className="min-w-0 flex-1 text-sm text-[var(--color-on-surface)]">
          {missingCount} athlete{missingCount === 1 ? '' : 's'} missing from {dateLabel} entirely
        </span>
        <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[10px] font-black text-[var(--color-outline)]">
          {missingCount}/{squadSize}
        </span>
        <span
          className={`material-symbols-outlined shrink-0 text-[var(--color-on-surface-variant)] transition-transform duration-200 ${
            expanded ? 'rotate-90' : ''
          }`}
          aria-hidden
        >
          chevron_right
        </span>
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-2 border-t border-[var(--color-outline-variant)] px-3 pb-4 pt-3">
          {missingAthletes.map((athlete) => (
            <span
              key={athlete.id}
              className="rounded-full bg-[var(--color-surface)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-on-surface)]"
            >
              {athleteDisplayName(athlete)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CoverageSummaryCards({ dateSummaries }) {
  if (!dateSummaries?.length) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dateSummaries.map((summary) => {
          const { session, testedCount, fullyTestedCount, squadSize, testCount } = summary;
          return (
            <div
              key={session.id}
              className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                {formatShortTestingDate(session.assessed_on)}
              </p>
              <CoverageProgressMetric
                label="Tested (any data)"
                count={testedCount}
                total={squadSize}
              />
              <CoverageProgressMetric
                label={`Fully tested (all ${testCount})`}
                count={fullyTestedCount}
                total={squadSize}
              />
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        {dateSummaries.map((summary) => (
          <MissingAthletesRow key={summary.session.id} summary={summary} />
        ))}
      </div>
    </div>
  );
}
