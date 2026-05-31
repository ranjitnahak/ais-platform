import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { isReportsNavVisible } from '../nav/navResourceMap';
import { snapshotToReportData } from '../lib/staffLogsShare';
import { formatRangeLabel } from '../lib/staffLogsConstants';
import StaffLogsReport from '../components/reports/StaffLogsReport';
import Sidebar from '../components/Sidebar';
import { TopBarUserMenu } from '../components/layout/TopBar';

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary-container)] border-t-transparent" />
    </div>
  );
}

function relation(row) {
  return Array.isArray(row) ? row[0] : row;
}

function formatSharedDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function StaffLogReportView() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUser();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    async function loadReport() {
      try {
        setLoading(true);
        setError(null);
        const { data, error: reportError } = await supabase
          .from('staff_log_reports')
          .select(`
            id, org_id, team_id, created_at, date_range_start, date_range_end, snapshot,
            teams(id, name, sport, logo_url)
          `)
          .eq('id', reportId)
          .single();
        if (reportError) throw reportError;
        if (!mounted) return;
        setReport(data);
      } catch (err) {
        console.error('[StaffLogReportView]', err);
        if (mounted) setError('Report not found or access denied.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadReport();
    return () => {
      mounted = false;
    };
  }, [reportId, user]);

  const reportData = useMemo(
    () => (report?.snapshot ? snapshotToReportData(report.snapshot) : null),
    [report],
  );

  if (userLoading || loading) return <Spinner />;
  if (!user || !isReportsNavVisible(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] text-[var(--color-on-surface)]">
        Access denied
      </div>
    );
  }
  if (error || !report || !reportData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-background)] text-[var(--color-on-surface)]">
        <p>{error ?? 'Report not found.'}</p>
        <button
          type="button"
          onClick={() => navigate('/reports')}
          className="text-xs font-black uppercase tracking-widest text-[var(--color-primary)]"
        >
          Back to reports
        </button>
      </div>
    );
  }

  const team = relation(report.teams) ?? reportData.team;
  const sharedBy = reportData.sharedBy;
  const sharedAt = formatSharedDate(reportData.sharedAt ?? report.created_at);
  const rangeLabel = formatRangeLabel(reportData.dateFrom, reportData.dateTo);

  return (
    <div className="min-h-screen bg-[var(--color-background)] font-['Inter'] text-[var(--color-on-background)]">
      <Sidebar />
      <header className="fixed top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[var(--color-outline-variant)] bg-[var(--color-background)]/80 px-6 backdrop-blur-xl lg:pl-72">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="material-symbols-outlined text-[var(--color-on-surface)] lg:hidden"
          >
            arrow_back
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Shared staff logs
            </p>
            <h1 className="text-lg font-black text-[var(--color-on-surface)]">
              {team?.name ?? 'Team'}
            </h1>
          </div>
        </div>
        <TopBarUserMenu />
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-32 pt-24 lg:pl-72">
        <div className="mb-6 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4 text-sm text-[var(--color-on-surface-variant)]">
          <p>{reportData.reportType} · {rangeLabel}</p>
          {(sharedBy || sharedAt) && (
            <p className="mt-1 text-xs">
              {[sharedBy ? `Shared by ${sharedBy}` : null, sharedAt ? `on ${sharedAt}` : null]
                .filter(Boolean)
                .join(' ')}
            </p>
          )}
        </div>

        <StaffLogsReport
          team={team}
          roster={reportData.roster}
          notesByAthleteId={reportData.notesByAthleteId}
          teamNotes={reportData.teamNotes}
          dateFrom={reportData.dateFrom}
          dateTo={reportData.dateTo}
          athleteFilter={reportData.athleteFilter}
          sharedMode
        />
      </main>
    </div>
  );
}
