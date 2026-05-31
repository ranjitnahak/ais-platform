import { buildReportPDF } from './buildReportPDF';
import { safeFileName } from './staffLogsConstants';

export async function downloadStaffLogsPdf(reportEl, { team, dateFrom, dateTo }) {
  if (!reportEl) return;

  const teamSlug = safeFileName(team?.name ?? 'team');
  const rangeSlug = `${dateFrom ?? 'start'}_${dateTo ?? 'end'}`.replace(/[^a-z0-9]+/gi, '-');
  const filename = `${teamSlug}_staff_logs_${rangeSlug}.pdf`;

  await buildReportPDF({
    contentEl: reportEl,
    teamLogoUrl: team?.logo_url ?? null,
    filename,
  });
}
