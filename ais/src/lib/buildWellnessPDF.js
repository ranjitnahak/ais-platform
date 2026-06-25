/**
 * buildWellnessPDF
 * Pure async function. Native jsPDF drawing only — no React, no DOM, no html2canvas.
 */
import { TIER_COLORS } from './chartColors';
import { getWellnessZone } from './zoneBadge';
import {
  WELLNESS_METRIC_COLUMNS,
  WELLNESS_SORE_AREA_LABEL,
} from './wellnessDashboardConstants';
import { pdfFillRect, pdfLine, pdfText } from './pdfHelpers';

const C = {
  surface: '#131315',
  surfaceContainer: '#1f1f21',
  surfaceHigh: '#2a2a2c',
  onSurface: '#e4e2e4',
  onSurfaceVariant: '#e0c0b1',
  primary: '#F97316',
  error: '#ffb4ab',
  outlineVariant: '#584237',
  textMuted: '#9ca3af',
};

const MARGIN = 15;
const HEADER_H = 22;
const FOOTER_H = 14;
const ORANGE_RULE = 0.6;

const NAME_COL_W = 42;
const SORE_COL_MIN_W = 38;
const TABLE_HEADER_H = 10;
const BASE_ROW_H = 10;
const ROW_PAD = 2;

function getPageLayout(pdf) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentTop = MARGIN + HEADER_H + ORANGE_RULE + 6;
  return {
    pageW,
    pageH,
    contentW: pageW - MARGIN * 2,
    contentTop,
    contentBottom: pageH - MARGIN - FOOTER_H,
  };
}

function computeColumnLayout(contentW) {
  const soreColW = SORE_COL_MIN_W;
  const metricCount = WELLNESS_METRIC_COLUMNS.length;
  const metricColW = (contentW - NAME_COL_W - soreColW) / metricCount;
  return { nameColW: NAME_COL_W, metricColW, soreColW, contentW };
}

function zoneToHex(zone) {
  if (zone === 'safe') return TIER_COLORS.excellent;
  if (zone === 'danger') return TIER_COLORS.belowAverage;
  if (zone === 'caution') return TIER_COLORS.average;
  return C.textMuted;
}

function blendHexOnSurface(tierHex, surfaceHex = C.surfaceContainer, opacity = 0.18) {
  const parse = (hex) => {
    const n = hex.replace('#', '');
    return [
      parseInt(n.slice(0, 2), 16),
      parseInt(n.slice(2, 4), 16),
      parseInt(n.slice(4, 6), 16),
    ];
  };
  const [tr, tg, tb] = parse(tierHex);
  const [sr, sg, sb] = parse(surfaceHex);
  const r = Math.round(tr * opacity + sr * (1 - opacity));
  const g = Math.round(tg * opacity + sg * (1 - opacity));
  const b = Math.round(tb * opacity + sb * (1 - opacity));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function imageFormat(base64) {
  if (base64?.startsWith('data:image/png')) return 'PNG';
  if (base64?.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

function athleteInitials(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

function formatMetricValue(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isFinite(n)) {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }
  return String(value);
}

function fillPageBackground(pdf, layout) {
  pdfFillRect(pdf, 0, 0, layout.pageW, layout.pageH, C.surface);
}

function drawLogos(pdf, layout, { orgLogoBase64, orgLogoDims, aisLogoBase64, aisLogoDims }) {
  const logoH = 10;
  const logoY = MARGIN + (HEADER_H - logoH) / 2;

  if (orgLogoBase64 && orgLogoDims?.w > 0 && orgLogoDims?.h > 0) {
    const lw = Math.min((orgLogoDims.w / orgLogoDims.h) * logoH, 36);
    try {
      pdf.addImage(orgLogoBase64, imageFormat(orgLogoBase64), MARGIN, logoY, lw, logoH);
    } catch { /* skip */ }
  }

  if (aisLogoBase64 && aisLogoDims?.w > 0 && aisLogoDims?.h > 0) {
    const lw = Math.min((aisLogoDims.w / aisLogoDims.h) * logoH, 36);
    try {
      pdf.addImage(
        aisLogoBase64,
        imageFormat(aisLogoBase64),
        layout.pageW - MARGIN - lw,
        logoY,
        lw,
        logoH,
      );
    } catch { /* skip */ }
  }
}

function drawPageChrome(pdf, layout, chrome) {
  fillPageBackground(pdf, layout);
  drawLogos(pdf, layout, chrome);
  pdfFillRect(pdf, 0, MARGIN + HEADER_H, layout.pageW, ORANGE_RULE, C.primary);
}

function drawFooters(pdf, layout) {
  const n = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= n; i += 1) {
    pdf.setPage(i);
    const footerY = layout.pageH - MARGIN;
    pdfFillRect(pdf, MARGIN, footerY - FOOTER_H, layout.contentW, FOOTER_H, C.surface);
    pdfLine(pdf, MARGIN, footerY - FOOTER_H + 2, layout.pageW - MARGIN, footerY - FOOTER_H + 2, C.outlineVariant, 0.2);
    pdfText(pdf, 'Athlete Intelligence System', layout.pageW - MARGIN, footerY - 5, 7, C.onSurfaceVariant, 'normal', { align: 'right' });
    pdfText(pdf, `Page ${i} of ${n}`, layout.pageW - MARGIN, footerY - 1, 7, C.onSurface, 'bold', { align: 'right' });
  }
}

function createPaginator(pdf, layout, chrome) {
  let y = layout.contentTop;

  function newPage() {
    pdf.addPage();
    drawPageChrome(pdf, layout, chrome);
    y = layout.contentTop;
  }

  function ensureSpace(needed) {
    if (y + needed > layout.contentBottom) {
      newPage();
      return true;
    }
    return false;
  }

  return {
    pdf,
    layout,
    get y() { return y; },
    set y(v) { y = v; },
    ensureSpace,
    newPage,
    advance(dy) { y += dy; },
  };
}

function drawTitleBlock(pag, { orgName, dateLabel }) {
  pdfText(pag.pdf, 'Wellness Dashboard', MARGIN, pag.y + 4, 14, C.onSurface, 'bold');
  pag.advance(8);
  if (orgName) {
    pdfText(pag.pdf, orgName, MARGIN, pag.y + 3, 10, C.onSurfaceVariant, 'normal');
    pag.advance(6);
  }
  pdfText(pag.pdf, dateLabel, MARGIN, pag.y + 3, 8, C.textMuted, 'normal');
  pag.advance(10);
}

function drawSummaryTiles(pag, summary) {
  const { contentW } = pag.layout;
  const gap = 4;
  const tileW = (contentW - gap * 2) / 3;
  const tileH = 18;
  pag.ensureSpace(tileH + 6);

  const tiles = [
    { label: 'Submitted Today', value: `${summary.submitted} of ${summary.total}` },
    { label: 'Average Score', value: summary.average == null ? '—' : summary.average.toFixed(1) },
    { label: 'Flagged', value: String(summary.flagged) },
  ];

  tiles.forEach((tile, i) => {
    const x = MARGIN + i * (tileW + gap);
    pdfFillRect(pag.pdf, x, pag.y, tileW, tileH, C.surfaceContainer);
    pdfLine(pag.pdf, x, pag.y, x + tileW, pag.y, C.outlineVariant, 0.2);
    pdfText(pag.pdf, tile.label.toUpperCase(), x + 3, pag.y + 5, 5, C.textMuted, 'bold');
    pdfText(pag.pdf, tile.value, x + 3, pag.y + 13, 12, C.onSurface, 'bold');
  });

  pag.advance(tileH + 8);
}

function drawWellnessZonePill(pdf, x, y, colW, value, { inverse = false } = {}) {
  const formatted = formatMetricValue(value);
  if (formatted == null) {
    pdfText(pdf, '—', x + colW / 2, y, 6, C.textMuted, 'normal', { align: 'center' });
    return;
  }

  const zone = getWellnessZone(value, { inverse });
  const hex = zoneToHex(zone);
  const bg = blendHexOnSurface(hex);
  const pillH = 5;
  const fontSize = 6;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(fontSize);
  const textW = pdf.getTextWidth(formatted);
  const pillW = Math.min(colW - 4, textW + 4);
  const pillX = x + (colW - pillW) / 2;
  const pillY = y - pillH / 2;
  pdfFillRect(pdf, pillX, pillY, pillW, pillH, bg);
  pdfText(pdf, formatted, x + colW / 2, y, fontSize, hex, 'bold', { align: 'center' });
}

function drawHeaderCell(pdf, label, x, y, colW, headerH, align = 'center') {
  pdfFillRect(pdf, x, y, colW, headerH, C.surfaceHigh);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(5);
  pdf.setTextColor(C.textMuted);
  const lines = pdf.splitTextToSize(label.toUpperCase(), colW - 4);
  const lineH = 2.5;
  const blockH = lines.length * lineH;
  const startY = y + (headerH - blockH) / 2 + lineH / 2;
  lines.forEach((line, i) => {
    const tx = align === 'left' ? x + 2 : x + colW / 2;
    pdf.text(line, tx, startY + i * lineH, { align, baseline: 'middle' });
  });
}

function drawTableHeader(pag, cols) {
  pag.ensureSpace(TABLE_HEADER_H);
  const rowY = pag.y;
  let x = MARGIN;

  drawHeaderCell(pag.pdf, 'Athlete', x, rowY, cols.nameColW, TABLE_HEADER_H, 'left');
  x += cols.nameColW;

  for (const col of WELLNESS_METRIC_COLUMNS) {
    drawHeaderCell(pag.pdf, col.label, x, rowY, cols.metricColW, TABLE_HEADER_H);
    x += cols.metricColW;
  }

  drawHeaderCell(pag.pdf, WELLNESS_SORE_AREA_LABEL, x, rowY, cols.soreColW, TABLE_HEADER_H);
  pag.advance(TABLE_HEADER_H);
}

function estimateRowHeight(pdf, athlete, log, cols) {
  const nameLines = pdf.splitTextToSize(String(athlete.full_name ?? ''), cols.nameColW - 14);
  let soreLines = 1;
  if (log) {
    const areas = Array.isArray(log.responses?.soreness_areas)
      ? log.responses.soreness_areas.filter(Boolean)
      : [];
    if (areas.length) {
      soreLines = pdf.splitTextToSize(areas.join(', '), cols.soreColW - 4).length;
    }
  }
  const contentLines = Math.max(nameLines.length, soreLines, 1);
  return Math.max(BASE_ROW_H, contentLines * 3.5 + ROW_PAD * 2);
}

function drawAthleteNameCell(pdf, athlete, x, rowY, rowH, nameColW) {
  pdfFillRect(pdf, x, rowY, nameColW, rowH, C.surfaceContainer);

  const initials = athleteInitials(athlete.full_name);
  const avatarR = 3;
  const avatarCx = x + 5;
  const avatarCy = rowY + rowH / 2;
  pdf.setFillColor(C.surfaceHigh);
  pdf.circle(avatarCx, avatarCy, avatarR, 'F');
  pdfText(pdf, initials, avatarCx, avatarCy, 5, C.onSurface, 'bold', { align: 'center' });

  const nameX = x + 11;
  const nameW = nameColW - 13;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(C.onSurface);
  const nameLines = pdf.splitTextToSize(String(athlete.full_name ?? ''), nameW);
  const lineH = 3.5;
  const nameStartY = rowY + (rowH - nameLines.length * lineH) / 2 + lineH / 2;
  nameLines.forEach((line, i) => {
    pdf.text(line, nameX, nameStartY + i * lineH, { baseline: 'middle' });
  });
}

function drawSoreAreaCell(pdf, areas, x, rowY, rowH, soreColW) {
  pdfFillRect(pdf, x, rowY, soreColW, rowH, C.surfaceContainer);
  const list = Array.isArray(areas) ? areas.filter(Boolean) : [];
  if (!list.length) {
    pdfText(pdf, '—', x + soreColW / 2, rowY + rowH / 2, 6, C.textMuted, 'normal', { align: 'center' });
    return;
  }

  const text = list.join(', ');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(5.5);
  pdf.setTextColor(C.error);
  const lines = pdf.splitTextToSize(text, soreColW - 4);
  const lineH = 3;
  const startY = rowY + (rowH - lines.length * lineH) / 2 + lineH / 2;
  lines.forEach((line, i) => {
    pdf.text(line, x + soreColW / 2, startY + i * lineH, { align: 'center', baseline: 'middle' });
  });
}

function drawSubmittedRow(pag, athlete, log, cols, rowH) {
  const rowY = pag.y;
  const responses = log.responses ?? {};
  let x = MARGIN;

  drawAthleteNameCell(pag.pdf, athlete, x, rowY, rowH, cols.nameColW);
  x += cols.nameColW;

  for (const col of WELLNESS_METRIC_COLUMNS) {
    pdfFillRect(pag.pdf, x, rowY, cols.metricColW, rowH, C.surfaceContainer);
    drawWellnessZonePill(pag.pdf, x, rowY + rowH / 2, cols.metricColW, responses[col.key], { inverse: col.inverse });
    x += cols.metricColW;
  }

  drawSoreAreaCell(pag.pdf, responses.soreness_areas, x, rowY, rowH, cols.soreColW);
}

function drawUnsubmittedRow(pag, athlete, cols, rowH) {
  const rowY = pag.y;
  let x = MARGIN;

  drawAthleteNameCell(pag.pdf, athlete, x, rowY, rowH, cols.nameColW);
  x += cols.nameColW;

  const spanW = cols.contentW - cols.nameColW;
  pdfFillRect(pag.pdf, x, rowY, spanW, rowH, C.surfaceContainer);
  pdfText(
    pag.pdf,
    'Not submitted',
    x + spanW / 2,
    rowY + rowH / 2,
    6,
    C.textMuted,
    'bold',
    { align: 'center' },
  );
}

function drawWellnessTable(pag, athletes, logsByAthleteId, cols) {
  let headerOnPage = false;

  const drawHeaderIfNeeded = () => {
    if (!headerOnPage) {
      drawTableHeader(pag, cols);
      headerOnPage = true;
    }
  };

  for (const athlete of athletes) {
    const log = logsByAthleteId.get(athlete.id);
    const rowH = estimateRowHeight(pag.pdf, athlete, log, cols);

    if (pag.y + rowH > pag.layout.contentBottom) {
      pag.newPage();
      headerOnPage = false;
    }

    drawHeaderIfNeeded();

    if (log) {
      drawSubmittedRow(pag, athlete, log, cols, rowH);
    } else {
      drawUnsubmittedRow(pag, athlete, cols, rowH);
    }

    pag.advance(rowH);
  }
}

/**
 * @param {object} opts
 * @param {import('jspdf').jsPDF} opts.pdf
 * @param {object} opts.user
 * @param {{ base64: string|null, dims: object|null }} opts.orgLogo
 * @param {{ base64: string|null, dims: object|null }} opts.aisLogo
 * @param {object[]} opts.athletes
 * @param {object[]} opts.logs
 * @param {object} opts.summary
 */
export async function buildWellnessPDF({
  pdf,
  user,
  orgLogo,
  aisLogo,
  athletes,
  logs,
  summary,
}) {
  const layout = getPageLayout(pdf);
  const chrome = {
    orgLogoBase64: orgLogo?.base64 ?? null,
    orgLogoDims: orgLogo?.dims ?? null,
    aisLogoBase64: aisLogo?.base64 ?? null,
    aisLogoDims: aisLogo?.dims ?? null,
  };

  drawPageChrome(pdf, layout, chrome);
  const pag = createPaginator(pdf, layout, chrome);
  const cols = computeColumnLayout(layout.contentW);

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  drawTitleBlock(pag, { orgName: user?.orgName, dateLabel });
  drawSummaryTiles(pag, summary);

  pdfText(
    pag.pdf,
    `${summary.submitted} of ${summary.total} submitted`,
    MARGIN,
    pag.y + 3,
    7,
    C.textMuted,
    'bold',
  );
  pag.advance(8);

  const logsByAthleteId = new Map((logs ?? []).map((log) => [log.athlete_id, log]));
  drawWellnessTable(pag, athletes ?? [], logsByAthleteId, cols);

  drawFooters(pdf, layout);
  return pdf;
}
