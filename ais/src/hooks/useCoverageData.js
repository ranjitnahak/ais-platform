import { useMemo } from 'react';
import { computeCoverageData } from '../lib/coverageEngine';

export function useCoverageData({
  enabled,
  athletes,
  results,
  selectedTests,
  selectedTestingDates,
}) {
  return useMemo(() => {
    if (!enabled) return null;
    if (!athletes?.length || !selectedTests?.length || !selectedTestingDates?.length) {
      return {
        index: {},
        dateSummaries: [],
        testDateMatrix: [],
        athleteRows: [],
      };
    }

    return computeCoverageData({
      athletes,
      results: results ?? [],
      selectedTests,
      selectedTestingDates,
    });
  }, [enabled, athletes, results, selectedTests, selectedTestingDates]);
}
