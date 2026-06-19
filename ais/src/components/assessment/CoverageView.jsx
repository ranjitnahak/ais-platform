import CoverageSummaryCards from './CoverageSummaryCards';
import CoverageTestMatrix from './CoverageTestMatrix';
import CoverageAthleteTable from './CoverageAthleteTable';

function SectionHeading({ children }) {
  return (
    <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
      {children}
    </h2>
  );
}

export default function CoverageView({
  coverageData,
  selectedTests,
  selectedTestingDates,
}) {
  const { dateSummaries, testDateMatrix, athleteRows } = coverageData ?? {};
  const testCount = selectedTests.length;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <SectionHeading>Per-date summary</SectionHeading>
        <CoverageSummaryCards dateSummaries={dateSummaries} />
      </section>

      <section className="space-y-4">
        <SectionHeading>Coverage by test × testing date</SectionHeading>
        <CoverageTestMatrix
          testDateMatrix={testDateMatrix}
          selectedTestingDates={selectedTestingDates}
        />
      </section>

      <section className="space-y-4">
        <SectionHeading>Athlete-wise coverage</SectionHeading>
        <CoverageAthleteTable
          athleteRows={athleteRows}
          selectedTestingDates={selectedTestingDates}
          testCount={testCount}
        />
      </section>
    </div>
  );
}
