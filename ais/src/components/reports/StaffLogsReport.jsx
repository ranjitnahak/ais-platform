import { useRef, useState } from 'react';
import { printStaffLogsReport } from '../../lib/staffLogsExport';
import {
  buildStaffLogsSnapshot,
  copyStaffLogsLink,
  createStaffLogsShare,
  shareStaffLogsLinkNative,
  STAFF_LOGS_REPORT_TYPE,
} from '../../lib/staffLogsShare';
import { ALL } from '../../lib/staffLogsConstants';
import ShareStaffLogsModal from './ShareStaffLogsModal';
import StaffLogsAthleteRow from './StaffLogsAthleteRow';
import StaffLogsTeamSection from './StaffLogsTeamSection';

function formatGeneratedDate(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString(undefined, {
    day: 'numeric', month: 'numeric', year: 'numeric',
  });
}

export default function StaffLogsReport({
  team,
  org,
  roster,
  notesByAthleteId,
  teamNotes,
  dateFrom,
  dateTo,
  athleteFilter,
  staffFilter,
  roleFilter,
  domainFilter,
  orgId,
  userId,
  sharedByName,
  sharedMode = false,
  generatedOn,
}) {
  const reportRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNotice, setShareNotice] = useState(null);

  const displayRoster = athleteFilter !== ALL
    ? roster.filter((athlete) => athlete.id === athleteFilter)
    : roster;

  async function handlePrint() {
    if (!reportRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      await printStaffLogsReport(reportRef.current);
    } catch (err) {
      console.error('[StaffLogsReport]', err);
      setExportError(err.message ?? 'Print failed.');
    } finally {
      setExporting(false);
    }
  }

  async function handleShare() {
    if (!orgId || !userId || !team?.id) {
      setExportError('Cannot share — missing team or user context.');
      return;
    }
    setExporting(true);
    setExportError(null);
    setShareNotice(null);
    try {
      const snapshot = buildStaffLogsSnapshot({
        team,
        org,
        roster,
        notesByAthleteId,
        teamNotes,
        dateFrom,
        dateTo,
        athleteFilter,
        staffFilter,
        roleFilter,
        domainFilter,
        sharedBy: sharedByName,
      });
      const url = await createStaffLogsShare({
        orgId,
        teamId: team.id,
        userId,
        dateFrom,
        dateTo,
        snapshot,
      });
      setShareUrl(url);
    } catch (err) {
      console.error('[StaffLogsReport]', err);
      setExportError(err.message ?? 'Could not create share link.');
    } finally {
      setExporting(false);
    }
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    setShareBusy(true);
    try {
      await copyStaffLogsLink(shareUrl);
      setShareNotice('Link copied to clipboard.');
    } catch (err) {
      console.error('[StaffLogsReport]', err);
      setShareNotice('Could not copy link.');
    } finally {
      setShareBusy(false);
    }
  }

  async function handleNativeShare() {
    if (!shareUrl) return;
    setShareBusy(true);
    try {
      await shareStaffLogsLinkNative({
        url: shareUrl,
        title: `${team?.name ?? 'Team'} — ${STAFF_LOGS_REPORT_TYPE}`,
        text: `${STAFF_LOGS_REPORT_TYPE} for ${team?.name ?? 'team'}`,
      });
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('[StaffLogsReport]', err);
      }
    } finally {
      setShareBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {!sharedMode && (
        <div className="no-print flex flex-wrap gap-3">
          <button
            type="button"
            disabled={exporting}
            onClick={handlePrint}
            className="rounded-xl bg-[var(--color-primary-container)] px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-60"
          >
            {exporting ? 'Preparing…' : 'Print / Save as PDF'}
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={handleShare}
            className="rounded-xl border border-[var(--color-outline-variant)] px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface)] disabled:opacity-60"
          >
            {exporting ? 'Creating link…' : 'Share'}
          </button>
        </div>
      )}

      {exportError && (
        <p className="no-print text-sm text-[var(--color-on-surface-variant)]">{exportError}</p>
      )}
      {shareNotice && (
        <p className="no-print text-sm text-[var(--color-on-surface-variant)]">{shareNotice}</p>
      )}

      <div
        id="staff-logs-report-content"
        ref={reportRef}
        className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]"
      >
        <header className="border-b border-[var(--color-outline-variant)] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black tracking-tight text-[var(--color-on-surface)] md:text-3xl">
              {team?.name ?? 'Team'}
            </h2>
            {team?.sport && (
              <span className="rounded-full bg-[var(--color-primary-container)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-primary)]">
                {team.sport}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
            Report period: {dateFrom} to {dateTo}
          </p>
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            Generated on {formatGeneratedDate(generatedOn)}
          </p>
        </header>

        <section>
          <h3 className="border-b border-[var(--color-outline-variant)] p-4 text-lg font-black text-[var(--color-on-surface)]">
            Individual Athlete Staff Logs
          </h3>
          {displayRoster.length === 0 ? (
            <p className="p-5 text-sm text-[var(--color-on-surface-variant)]">No athletes in this squad.</p>
          ) : (
            displayRoster.map((athlete) => (
              <StaffLogsAthleteRow
                key={athlete.id}
                athlete={athlete}
                notes={notesByAthleteId.get(athlete.id) ?? []}
              />
            ))
          )}
        </section>

        <StaffLogsTeamSection teamNotes={teamNotes} />
      </div>

      {shareUrl && (
        <ShareStaffLogsModal
          team={team}
          org={org}
          dateFrom={dateFrom}
          dateTo={dateTo}
          shareUrl={shareUrl}
          copying={shareBusy}
          onCopyLink={handleCopyLink}
          onShareNative={handleNativeShare}
          onClose={() => {
            setShareUrl(null);
            setShareNotice(null);
          }}
        />
      )}
    </div>
  );
}
