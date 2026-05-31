/**
 * Native-text Staff Logs PDF — selectable copy, clean page breaks, branded header/footer.
 */
import {
  AIS_LOGO_URL,
  drawPdfPageFooters,
  drawPdfPageHeader,
  loadLogoData,
  pdfContentBottom,
  pdfContentTop,
  pdfContentWidth,
  pdfText,
  pdfWrappedText,
  PDF_PAGE,
} from './pdfPageChrome';
import {
  DOMAIN_LABELS,
  formatNoteDate,
  getAge,
  initials,
} from './staffLogsConstants';
import { athleteDisplayName } from './athleteName';

const MUTED = '#666666';
const RULE = '#dddddd';
const PHOTO_SIZE = 18;
const PHOTO_COL = 38;
const NOTE_X = PDF_PAGE.MARGIN + PHOTO_COL + 4;

function formatGeneratedDate(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString(undefined, {
    day: 'numeric', month: 'numeric', year: 'numeric',
  });
}

function estimateNoteHeight(pdf, note, noteW) {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const bodyLines = pdf.splitTextToSize(String(note.note_text ?? ''), noteW).length;
  return 8 + bodyLines * 4.5 + 6;
}

function estimateAthleteHeight(pdf, notes, contentW) {
  const noteW = contentW - PHOTO_COL - 4;
  let h = PHOTO_SIZE + 14;
  for (const note of notes ?? []) {
    h += estimateNoteHeight(pdf, note, noteW);
  }
  return Math.max(h, PHOTO_SIZE + 20) + 8;
}

function drawAthletePhoto(pdf, athlete, displayName, x, y) {
  const photoBase64 = athlete?._photoBase64;
  if (photoBase64) {
    try {
      pdf.addImage(photoBase64, 'JPEG', x, y, PHOTO_SIZE, PHOTO_SIZE);
      return;
    } catch { /* fall through */ }
  }
  pdf.setFillColor('#f3f4f6');
  pdf.circle(x + PHOTO_SIZE / 2, y + PHOTO_SIZE / 2, PHOTO_SIZE / 2, 'F');
  pdfTextCentered(pdf, initials(displayName), x + PHOTO_SIZE / 2, y + PHOTO_SIZE / 2 + 2, 9, 'bold', '#f97316');
}

function pdfTextCentered(pdf, str, cx, y, size, style, color) {
  pdf.setFont('helvetica', style);
  pdf.setFontSize(size);
  pdf.setTextColor(color);
  pdf.text(String(str), cx, y, { align: 'center' });
}

async function preloadAthletePhotos(roster) {
  const map = new Map();
  await Promise.all(
    (roster ?? []).map(async (athlete) => {
      if (!athlete?.photo_url) return;
      try {
        const res = await fetch(athlete.photo_url, { mode: 'cors', cache: 'no-cache' });
        if (!res.ok) return;
        const blob = await res.blob();
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
        if (base64) map.set(athlete.id, base64);
      } catch { /* skip */ }
    }),
  );
  return map;
}

/**
 * @param {object} opts
 * @param {object} opts.team
 * @param {string} opts.dateFrom
 * @param {string} opts.dateTo
 * @param {string|Date} [opts.generatedOn]
 * @param {object[]} opts.roster
 * @param {Map<string, object[]>} opts.notesByAthleteId
 * @param {object[]} opts.teamNotes
 * @param {string} opts.filename
 */
export async function buildStaffLogsPDF({
  team,
  dateFrom,
  dateTo,
  generatedOn,
  roster,
  notesByAthleteId,
  teamNotes,
  filename,
}) {
  const [{ default: jsPDF }] = await Promise.all([import('jspdf')]);

  const [teamLogo, aisLogo] = await Promise.all([
    loadLogoData(team?.logo_url ?? null),
    loadLogoData(AIS_LOGO_URL),
  ]);

  const photoMap = await preloadAthletePhotos(roster);
  const rosterWithPhotos = (roster ?? []).map((a) => ({
    ...a,
    _photoBase64: photoMap.get(a.id) ?? null,
  }));

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const contentW = pdfContentWidth();
  const noteW = contentW - PHOTO_COL - 4;
  let y = pdfContentTop();
  const x = PDF_PAGE.MARGIN;

  drawPdfPageHeader(pdf, { teamLogo, aisLogo });

  function ensureSpace(needed) {
    if (y + needed > pdfContentBottom()) {
      pdf.addPage();
      drawPdfPageHeader(pdf, { teamLogo, aisLogo });
      y = pdfContentTop();
    }
  }

  // Report title block
  pdfText(pdf, team?.name ?? 'Team', x, y, 18, 'bold');
  y += 8;
  if (team?.sport) {
    pdfText(pdf, team.sport.toUpperCase(), x, y, 8, 'bold', '#f97316');
    y += 6;
  }
  pdfText(pdf, `Report period: ${dateFrom} to ${dateTo}`, x, y, 10, 'normal', MUTED);
  y += 5;
  pdfText(pdf, `Generated on ${formatGeneratedDate(generatedOn)}`, x, y, 9, 'normal', MUTED);
  y += 10;

  pdf.setDrawColor(RULE);
  pdf.setLineWidth(0.3);
  pdf.line(x, y, x + contentW, y);
  y += 8;

  pdfText(pdf, 'Individual Athlete Staff Logs', x, y, 13, 'bold');
  y += 10;

  for (const athlete of rosterWithPhotos) {
    const displayName = athleteDisplayName(athlete) || athlete?.full_name || 'Athlete';
    const notes = notesByAthleteId?.get?.(athlete.id) ?? notesByAthleteId?.[athlete.id] ?? [];
    const age = getAge(athlete?.date_of_birth);
    const meta = [
      athlete?.position ?? 'Position not set',
      [athlete?.gender, age ? `Age ${age}` : null].filter(Boolean).join(' · '),
    ].filter(Boolean);

    ensureSpace(estimateAthleteHeight(pdf, notes, contentW));

    const rowTop = y;
    drawAthletePhoto(pdf, athlete, displayName, x, y);

    const nameX = x + PHOTO_COL;
    pdfText(pdf, displayName, nameX, y + 4, 11, 'bold');
    let metaY = y + 9;
    for (const line of meta) {
      pdfText(pdf, line, nameX, metaY, 8, 'normal', MUTED);
      metaY += 4;
    }

    let noteY = Math.max(metaY + 4, rowTop + PHOTO_SIZE + 6);
    for (const note of notes) {
      const authorName = note.users?.full_name ?? 'Staff';
      const domainLabel = DOMAIN_LABELS[note.domain] ?? note.domain ?? 'General';
      const header = `${authorName} · ${domainLabel} · ${formatNoteDate(note.observation_date)}`;
      const blockH = estimateNoteHeight(pdf, note, noteW);
      ensureSpace(blockH);
      if (noteY + blockH > pdfContentBottom()) {
        noteY = pdfContentTop();
      }
      pdfText(pdf, header.toUpperCase(), NOTE_X, noteY, 7, 'bold', MUTED);
      noteY = pdfWrappedText(pdf, note.note_text, NOTE_X, noteY + 5, noteW, 4.5, 10, '#333333') + 6;
    }

    y = Math.max(noteY, rowTop + PHOTO_SIZE + 14) + 4;
    pdf.setDrawColor(RULE);
    pdf.line(x, y, x + contentW, y);
    y += 6;
  }

  // Team notes
  if ((teamNotes ?? []).length > 0) {
    ensureSpace(20);
    pdfText(pdf, 'Team Notes', x, y, 13, 'bold');
    y += 8;
    for (const note of teamNotes) {
      const authorName = note.users?.full_name ?? 'Staff';
      const domainLabel = DOMAIN_LABELS[note.domain] ?? note.domain ?? 'General';
      const header = `${authorName} · ${domainLabel} · ${formatNoteDate(note.observation_date)}`;
      const blockH = estimateNoteHeight(pdf, note, contentW);
      ensureSpace(blockH);
      pdfText(pdf, header.toUpperCase(), x, y, 7, 'bold', MUTED);
      y = pdfWrappedText(pdf, note.note_text, x, y + 5, contentW, 4.5, 10, '#333333') + 8;
    }
  }

  drawPdfPageFooters(pdf);

  pdf.save(filename);
}
