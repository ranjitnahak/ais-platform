/**
 * Orchestrates Assessment Dashboard PDF export — loads assets, assembles payload, saves file.
 * All dashboard data must be pre-resolved by the caller (no scoring recompute here).
 */
import { slugifyFilename } from './buildDashboardPDF';
import { buildAssessmentPDF } from './buildAssessmentPDF';
import { athleteDisplayName } from './athleteName';
import { toTitleCase } from './formatters';
import { AIS_LOGO_URL, loadLogoData } from './pdfPageChrome';
import { cropToCircle, urlToBase64 } from './pdfHelpers';
import { supabase } from './supabase';

function computeAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthday =
    today.getMonth() > birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

export function assessmentPdfFilename({ mode, athleteName, teamName }) {
  const date = new Date().toISOString().slice(0, 10);
  const teamSlug = slugifyFilename(teamName ?? 'team');
  if (mode === 'athlete') {
    return `assessment_${slugifyFilename(athleteName ?? 'athlete')}_${date}.pdf`;
  }
  if (mode === 'coverage') {
    return `assessment_${teamSlug}_coverage_${date}.pdf`;
  }
  if (mode === 'matrix') {
    return `assessment_${teamSlug}_matrix_${date}.pdf`;
  }
  return `assessment_${teamSlug}_${date}.pdf`;
}

async function loadSignatory(orgId, user) {
  let signatoryName = user?.fullName ?? null;
  let signatoryTitle = user?.roleLabel ?? null;

  if (!orgId) return { signatoryName, signatoryTitle };

  try {
    const { data, error } = await supabase
      .from('organisations')
      .select('report_signatory_name, report_signatory_title')
      .eq('id', orgId)
      .maybeSingle();
    if (error) throw error;
    if (data?.report_signatory_name) signatoryName = data.report_signatory_name;
    if (data?.report_signatory_title) signatoryTitle = data.report_signatory_title;
  } catch (err) {
    console.error('[exportAssessmentPDF] signatory load failed:', err);
  }

  return { signatoryName, signatoryTitle };
}

/**
 * @param {object} opts
 * @param {'athlete'|'team'|'matrix'|'coverage'} opts.mode
 * @param {object} opts.user — from useUser()
 * @param {string|null} opts.teamLogoUrl
 * @param {object} opts.dashboard — hook outputs (filters, data)
 */
export async function exportAssessmentDashboardPDF({
  mode,
  user,
  teamLogoUrl,
  dashboard,
}) {
  const {
    filters,
    teamName,
    athleteProfile,
    selectedTests,
    selectedTestingDates,
    individualProgressions,
    summaryCardPercentiles,
    compositeClassification,
    benchmarkTiersByTest,
    squadTestMultiples,
    coverageData,
    matrixRows,
  } = dashboard;

  if (mode === 'athlete' && !filters.athleteId) {
    throw new Error('Select an athlete to export.');
  }

  if (mode === 'team' && !filters.testIds?.length) {
    throw new Error('Select at least one test to export.');
  }

  if ((mode === 'coverage' || mode === 'matrix') && !filters.testIds?.length) {
    throw new Error('Select at least one test to export.');
  }

  if ((mode === 'coverage' || mode === 'matrix') && !filters.sessionIds?.length) {
    throw new Error('Select at least one testing date to export.');
  }

  const [teamLogo, aisLogo, signatory, athletePhotoRaw] = await Promise.all([
    loadLogoData(teamLogoUrl ?? null),
    loadLogoData(AIS_LOGO_URL),
    loadSignatory(user?.orgId, user),
    mode === 'athlete' && athleteProfile?.photo_url
      ? urlToBase64(athleteProfile.photo_url)
      : Promise.resolve(null),
  ]);

  let athletePhotoBase64 = athletePhotoRaw;
  if (athletePhotoBase64) {
    athletePhotoBase64 = await cropToCircle(athletePhotoBase64);
  }

  const athleteName = athleteProfile ? athleteDisplayName(athleteProfile) : '';
  const filename = assessmentPdfFilename({
    mode,
    athleteName,
    teamName,
  });

  const [{ default: jsPDF }] = await Promise.all([import('jspdf')]);
  const pdf = new jsPDF({
    orientation: mode === 'matrix' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  await buildAssessmentPDF({
    pdf,
    mode,
    teamName,
    teamLogoBase64: teamLogo.base64,
    teamLogoDims: teamLogo.dims,
    aisLogoBase64: aisLogo.base64,
    aisLogoDims: aisLogo.dims,
    signatoryName: signatory.signatoryName,
    signatoryTitle: signatory.signatoryTitle,
    athleteName,
    athletePosition: athleteProfile?.position ? toTitleCase(athleteProfile.position) : null,
    athleteAge: computeAge(athleteProfile?.date_of_birth),
    athletePhotoBase64,
    selectedTests,
    summaryCardPercentiles,
    compositeClassification,
    individualProgressions,
    benchmarkTiersByTest,
    selectedTestingDates,
    squadTestMultiples,
    coverageData,
    matrixRows,
  });

  pdf.save(filename);
  return filename;
}
