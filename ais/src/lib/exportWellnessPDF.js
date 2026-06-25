/**
 * Orchestrates Wellness Dashboard PDF export — loads assets, assembles payload, saves file.
 * All dashboard data must be pre-resolved by the caller (no Supabase inside drawer).
 */
import { buildWellnessPDF } from './buildWellnessPDF';
import { dashboardPdfFilename } from './buildDashboardPDF';
import { AIS_LOGO_URL, loadLogoData } from './pdfPageChrome';

/**
 * @param {object} opts
 * @param {object} opts.user — from useUser()
 * @param {string|null} opts.orgLogoUrl
 * @param {object[]} opts.athletes
 * @param {object[]} opts.logs
 * @param {{ submitted: number, total: number, average: number|null, flagged: number }} opts.summary
 */
export async function exportWellnessDashboardPDF({
  user,
  orgLogoUrl,
  athletes,
  logs,
  summary,
}) {
  if (!athletes?.length) {
    throw new Error('No athletes to export.');
  }

  const [orgLogo, aisLogo] = await Promise.all([
    loadLogoData(orgLogoUrl ?? null),
    loadLogoData(AIS_LOGO_URL),
  ]);

  const filename = dashboardPdfFilename({
    orgName: user?.orgName,
    dashboardSlug: 'wellness',
  });

  const [{ default: jsPDF }] = await Promise.all([import('jspdf')]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  await buildWellnessPDF({
    pdf,
    user,
    orgLogo,
    aisLogo,
    athletes,
    logs,
    summary,
  });

  pdf.save(filename);
  return filename;
}
