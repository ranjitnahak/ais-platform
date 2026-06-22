import { useMemo, useRef } from 'react';
import { canSync } from '../../lib/auth';
import { dashboardPdfFilename } from '../../lib/buildDashboardPDF';
import { useUser } from '../../context/UserContext';
import { useAttendanceDashboard } from '../../hooks/useAttendanceDashboard';
import DashboardExportButton from '../shared/DashboardExportButton';
import DashboardPanelHeader from '../shared/DashboardPanelHeader';
import DashboardSkeleton from '../shared/skeletons/DashboardSkeleton';
import AttendanceAthleteTable from './AttendanceAthleteTable';
import AttendanceMetricCards from './AttendanceMetricCards';
import AttendanceTrendChart from './AttendanceTrendChart';
import ReasonBreakdownChart from './ReasonBreakdownChart';

const RANGE_OPTIONS = [
  { value: '4W', label: 'Last 4 weeks' },
  { value: 'season', label: 'Full season' },
];

export default function AttendanceDashboard({ embedded = false }) {
  const { user } = useUser();
  const exportRef = useRef(null);
  const canView = canSync(user, 'attendance', 'view') || Boolean(user?.isSuperuser);

  const {
    loading,
    error,
    filters,
    setFilter,
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

      <div data-pdf-exclude className="flex flex-wrap items-center gap-3 lg:ml-auto lg:justify-end">
        <div className="flex rounded-full border border-[var(--color-outline-variant)] p-0.5">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter('range', option.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors ${
                filters.range === option.value
                  ? 'bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)]'
                  : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="text-[10px] font-bold text-[var(--color-on-surface-variant)]">
          {dateRangeLabel}
        </span>
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
