import { supabase } from './supabase';
import { ALL } from './staffLogsConstants';

export const STAFF_LOGS_REPORT_TYPE = 'Staff Logs Report';

export function buildStaffLogsSnapshot({
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
  sharedBy,
}) {
  const displayRoster = athleteFilter !== ALL
    ? roster.filter((athlete) => athlete.id === athleteFilter)
    : roster;

  const notesObj = {};
  for (const [athleteId, athleteNotes] of notesByAthleteId.entries()) {
    notesObj[athleteId] = athleteNotes;
  }

  return {
    report_type: STAFF_LOGS_REPORT_TYPE,
    team: {
      id: team?.id ?? null,
      name: team?.name ?? 'Team',
      sport: team?.sport ?? null,
      logo_url: team?.logo_url ?? null,
    },
    org: {
      name: org?.name ?? null,
      logo_url: org?.logo_url ?? null,
    },
    roster: displayRoster,
    notesByAthleteId: notesObj,
    teamNotes: teamNotes ?? [],
    filters: {
      dateFrom,
      dateTo,
      athleteFilter,
      staffFilter,
      roleFilter,
      domainFilter,
    },
    sharedBy: sharedBy ?? null,
    sharedAt: new Date().toISOString(),
  };
}

export function snapshotToReportData(snapshot) {
  const notesByAthleteId = new Map(
    Object.entries(snapshot?.notesByAthleteId ?? {}).map(([id, notes]) => [id, notes]),
  );
  return {
    team: snapshot?.team ?? {},
    org: snapshot?.org ?? {},
    roster: snapshot?.roster ?? [],
    notesByAthleteId,
    teamNotes: snapshot?.teamNotes ?? [],
    dateFrom: snapshot?.filters?.dateFrom ?? '',
    dateTo: snapshot?.filters?.dateTo ?? '',
    athleteFilter: snapshot?.filters?.athleteFilter ?? ALL,
    reportType: snapshot?.report_type ?? STAFF_LOGS_REPORT_TYPE,
    sharedBy: snapshot?.sharedBy ?? null,
    sharedAt: snapshot?.sharedAt ?? null,
  };
}

export function staffLogsShareUrl(reportId) {
  return `${window.location.origin}/reports/staff-logs/${reportId}`;
}

export async function createStaffLogsShare({
  orgId,
  teamId,
  userId,
  dateFrom,
  dateTo,
  snapshot,
}) {
  const { data, error } = await supabase
    .from('staff_log_reports')
    .insert({
      org_id: orgId,
      team_id: teamId,
      created_by: userId,
      date_range_start: dateFrom || null,
      date_range_end: dateTo || null,
      snapshot,
    })
    .select('id')
    .single();

  if (error) throw error;
  return staffLogsShareUrl(data.id);
}

export async function copyStaffLogsLink(url) {
  await navigator.clipboard.writeText(url);
}

export async function shareStaffLogsLinkNative({ url, title, text }) {
  if (!navigator.share) return { shared: false };
  await navigator.share({ url, title, text });
  return { shared: true };
}
