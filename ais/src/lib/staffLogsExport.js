import { buildStaffLogsPDF } from './buildStaffLogsPDF';
import { safeFileName } from './staffLogsConstants';

export async function downloadStaffLogsPdf({
  team,
  dateFrom,
  dateTo,
  generatedOn,
  roster,
  notesByAthleteId,
  teamNotes,
}) {
  const teamSlug = safeFileName(team?.name ?? 'team');
  const rangeSlug = `${dateFrom ?? 'start'}_${dateTo ?? 'end'}`.replace(/[^a-z0-9]+/gi, '-');
  const filename = `${teamSlug}_staff_logs_${rangeSlug}.pdf`;

  await buildStaffLogsPDF({
    team,
    dateFrom,
    dateTo,
    generatedOn,
    roster,
    notesByAthleteId,
    teamNotes,
    filename,
  });
}
