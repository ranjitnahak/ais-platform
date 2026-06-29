import { useMemo, useRef } from 'react';
import { canSync } from '../../lib/auth';
import { dashboardPdfFilename } from '../../lib/buildDashboardPDF';
import { useUser } from '../../context/UserContext';
import { useAttendanceDashboard } from '../../hooks/useAttendanceDashboard';
import DashboardExportButton from '../shared/DashboardExportButton';
import DashboardDateRangeFilter from '../shared/DashboardDateRangeFilter';
import DashboardPanelHeader from '../shared/DashboardPanelHeader';
import DashboardSkeleton from '../shared/skeletons/DashboardSkeleton';
import AttendanceAthleteTable from './AttendanceAthleteTable';
import AttendanceMetricCards from './AttendanceMetricCards';
import AttendanceTrendChart from './AttendanceTrendChart';
import ReasonBreakdownChart from './ReasonBreakdownChart';

export default function AttendanceDashboard({ embedded = false }) {
  const { user } = useUser();
  const exportRef = useRef(null);
  const canView = canSync(user, 'attendance', 'view') || Boolean(user?.isSuperuser);

  const {
    loading,
    error,
    filters,
    setRangeFilter,
    setCustomDateRange,
    squadMetrics,
    weeklyTrend,
    reasonBreakdown,
    athleteSummary,
    dateRangeLabel,
    rangeLabel,
    activeTeamId,
    hasSessions,
  } = useAttendanceDashboard();

  const filterSnapshot = useMemo(
    () => `${rangeLabel} · ${dateRangeLabel}`,
    [rangeLabel, dateRangeLabel],
  );

  const exportFilename = dashboardPdfFilename({
    orgName: user?.orgName,
    dashboardSlug: 'attendance',
  });

  if (!canView) {
    return (
      <p className="rounded-2xl bg-[var(--color-surface-container)] p-6 text-sm font-bold text-[var(--color-on-surface-variant)]">
        You do not have permission to view attendance data.
      </p>
    );
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div ref={exportRef} className={`mx-auto max-w-6xl space-y-6 ${embedded ? '' : 'p-4'}`}>
      <DashboardPanelHeader
        title="Attendance"
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

      {error && (
        <p className="rounded-xl border border-[var(--color-error)] bg-[var(--color-surface-container)] px-4 py-3 text-sm font-bold text-[var(--color-error)]">
          {error}
        </p>
      )}

      <div data-pdf-exclude className="lg:ml-auto lg:flex lg:justify-end">
        <DashboardDateRangeFilter
          range={filters.range}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          dateRangeLabel={dateRangeLabel}
          onRangeChange={setRangeFilter}
          onCustomDatesChange={setCustomDateRange}
        />
      </div>

      {!activeTeamId ? (
        <p className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6 text-center text-sm text-[var(--color-on-surface-variant)]">
          Select a team from the header to view attendance.
        </p>
      ) : (
        <>
          <AttendanceMetricCards squadMetrics={squadMetrics} rangeLabel={rangeLabel} />

          <div className="grid gap-4 lg:grid-cols-2">
            <AttendanceTrendChart weeklyTrend={weeklyTrend} rangeLabel={rangeLabel} />
            <ReasonBreakdownChart reasonBreakdown={reasonBreakdown} rangeLabel={rangeLabel} />
          </div>

          {!hasSessions && (
            <p className="text-center text-xs font-bold text-[var(--color-on-surface-variant)]">
              No sessions scheduled in this period. Athletes with roster membership still appear below when applicable.
            </p>
          )}

          <AttendanceAthleteTable rows={athleteSummary} rangeLabel={rangeLabel} />
        </>
      )}
    </div>
  );
}
