/**
 * buildPeriodisationPDF
 * Pure async function. Accepts a jsPDF instance and plan data, draws the full
 * periodisation plan using jsPDF native drawing only.
 * No React, no DOM, no html2canvas.
 *
 * Hex colours are intentional here — CSS variables are not available in the
 * jsPDF drawing context. Every colour maps 1-to-1 with the canvas theme tokens.
 */
import { numberCellStyle, acwrStyle, peakingStyle, rowMetricKey } from './periodisationUtils';

// ── Layout constants (A4 landscape, mm) ──────────────────────────────────────
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 8;
const LABEL_COL = 48;
const HEADER_H = 18;
const ORANGE_RULE_H = 0.8;
const COL_HEADER_H = 6;
const GROUP_HEADER_H = 5;
const ROW_H = 6;
const CHART_H = 35;
export const WEEKS_PER_PAGE = 17;

const GRID_X = MARGIN + LABEL_COL;
const GRID_W = PAGE_W - MARGIN - LABEL_COL - MARGIN; // 233 mm

/** Parse #rgb or #rrggbb to { r, g, b } 0–255; null if invalid. */
function hexToRgb(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('#')) return null;
  let h = hex.slice(1).trim();
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** WCAG relative luminance 0–1 */
function relativeLuminance(rgb) {
  const lin = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(rgb.r);
  const g = lin(rgb.g);
  const b = lin(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Readable label on arbitrary band background (fixes white-on-pastel). */
function bandSpanTextColor(bgHex) {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#111827';
  const L = relativeLuminance(rgb);
  return L > 0.55 ? '#111827' : '#ffffff';
}

// ── Low-level drawing primitives ─────────────────────────────────────────────

function fillRect(pdf, x, y, w, h, hex) {
  pdf.setFillColor(hex);
  pdf.rect(x, y, w, h, 'F');
}

/** Draw a single straight border line */
function line(pdf, x1, y1, x2, y2, hex = '#e5e7eb', lw = 0.2) {
  pdf.setLineWidth(lw);
  pdf.setDrawColor(hex);
  pdf.line(x1, y1, x2, y2);
}

/** Shorthand for setting font + size + colour and writing text */
function txt(pdf, str, x, y, size, hex, fontStyle = 'normal', opts = {}) {
  if (str == null || str === '') return;
  pdf.setFont('helvetica', fontStyle);
  pdf.setFontSize(size);
  pdf.setTextColor(hex);
  pdf.text(String(str), x, y, { baseline: 'middle', ...opts });
}

// ── Data helpers ──────────────────────────────────────────────────────────────

/** Group visible rows by row_group, preserving insertion order */
function groupRows(rows) {
  const order = [];
  const map = {};
  for (const r of rows) {
    const g = r.row_group || 'Planning';
    if (!map[g]) { map[g] = []; order.push(g); }
    map[g].push(r);
  }
  return order.map((g) => ({ group: g, rows: map[g] }));
}

/** Exact-week cell lookup (no patches needed in PDF context) */
function findCell(rowId, monday, cells) {
  return cells.find((c) => c.row_id === rowId && c.cell_date === monday) ?? null;
}

/** Match Periodisation CellRenderer toggle “on” semantics (incl. value_text casing). */
function toggleCellIsOn(cell) {
  if (!cell) return false;
  const n = cell.value_number;
  if (n === 1 || n === '1' || Number(n) === 1) return true;
  const t = cell.value_text;
  return typeof t === 'string' && t.trim().toLowerCase() === 'on';
}

function formatDateRange(startIso, endIso) {
  if (!startIso) return '';
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  const a = new Date(startIso + 'T12:00:00').toLocaleDateString('en-GB', opts);
  const b = endIso ? new Date(endIso + 'T12:00:00').toLocaleDateString('en-GB', opts) : '';
  return b ? `${a} — ${b}` : a;
}

// ── Header strip ──────────────────────────────────────────────────────────────

function drawHeader(pdf, {
  planName, teamName, dateRange, pageNum, totalPages,
  teamLogoBase64, teamLogoDims,
  athleteName, athletePhotoBase64, athletePosition,
}) {
  fillRect(pdf, 0, 0, PAGE_W, HEADER_H, '#ffffff');

  const logoH = 10;
  const logoY = (HEADER_H - logoH) / 2;

  if (teamLogoBase64 && teamLogoDims?.w > 0 && teamLogoDims?.h > 0) {
    const lw = Math.min((teamLogoDims.w / teamLogoDims.h) * logoH, 36);
    try { pdf.addImage(teamLogoBase64, 'PNG', MARGIN, logoY, lw, logoH); } catch {}
  } else {
    txt(pdf, 'AIS', MARGIN, HEADER_H / 2, 9, '#111827', 'bold');
  }

  // Right: date range + page number (same for both)
  const rx = PAGE_W - MARGIN;
  if (dateRange) {
    txt(pdf, dateRange, rx, HEADER_H / 2 - 2, 6, '#6b7280', 'normal', { align: 'right' });
  }
  txt(pdf, `Page ${pageNum} of ${totalPages}`, rx, HEADER_H / 2 + 2.5, 6, '#111827', 'bold', { align: 'right' });

  const cx = PAGE_W / 2;

  if (athleteName) {
    // ── Individual athlete plan centre block ──────────────────────────────────
    const photoSize = 12;  // mm square
    const photoX = cx - photoSize / 2 - 10; // shift photo left to leave room for text
    const photoY = (HEADER_H - photoSize) / 2;
    const photoCx = photoX + photoSize / 2;
    const photoCy = photoY + photoSize / 2;
    const circleR = photoSize / 2 + 0.5; // slight overflow for border

    if (athletePhotoBase64) {
      try {
        pdf.addImage(athletePhotoBase64, 'JPEG', photoX, photoY, photoSize, photoSize);
      } catch {
        try {
          pdf.addImage(athletePhotoBase64, 'PNG', photoX, photoY, photoSize, photoSize);
        } catch {}
      }
    } else {
      // Fallback: filled circle with initials
      const parts = athleteName.trim().split(/\s+/);
      const initials = (
        (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
      ).toUpperCase();
      pdf.setFillColor('#e0e7ff');
      pdf.circle(photoCx, photoCy, circleR - 0.5, 'F');
      txt(pdf, initials, photoCx, photoCy, 7, '#3730a3', 'bold', { align: 'center' });
    }

    // Orange circular border around photo
    pdf.setDrawColor('#f97316');
    pdf.setLineWidth(0.5);
    pdf.circle(photoCx, photoCy, circleR, 'S');

    // Athlete name + subtitle to the right of photo
    const textX = photoX + photoSize + 3;
    txt(pdf, athleteName.toUpperCase(), textX, HEADER_H / 2 - 2, 9, '#111827', 'bold');

    const subtitle = teamName && athletePosition
      ? `${teamName} · ${athletePosition}`
      : (teamName || athletePosition || '');
    if (subtitle) {
      txt(pdf, subtitle, textX, HEADER_H / 2 + 2.5, 6, '#6b7280', 'normal');
    }
  } else {
    // ── Team plan centre block ────────────────────────────────────────────────
    txt(pdf, (planName || 'Periodisation Plan').toUpperCase(), cx, HEADER_H / 2 - 2, 9, '#111827', 'bold', { align: 'center' });
    if (teamName) {
      txt(pdf, teamName, cx, HEADER_H / 2 + 2.5, 6, '#6b7280', 'normal', { align: 'center' });
    }
  }

  // Orange rule immediately below header
  fillRect(pdf, 0, HEADER_H, PAGE_W, ORANGE_RULE_H, '#f97316');
}

// ── Band / text row ───────────────────────────────────────────────────────────

function drawBandRow(pdf, { row, weeks, cells, curY, colW }) {
  const first = weeks[0].monday;
  const last = weeks[weeks.length - 1].monday;

  const spans = cells.filter(
    (c) => c.row_id === row.id && c.value_text
      && c.cell_date <= last
      && (c.span_end_date || c.cell_date) >= first,
  );

  for (const cell of spans) {
    const spanEnd = cell.span_end_date || cell.cell_date;
    const si = weeks.findIndex((w) => w.monday >= cell.cell_date);
    const clampedStart = si === -1 ? 0 : si;
    const ei = weeks.findIndex((w) => w.monday > spanEnd);
    const clampedEnd = ei === -1 ? weeks.length - 1 : ei - 1;
    const spanCount = clampedEnd - clampedStart + 1;
    if (spanCount <= 0) continue;

    const bg = cell.value_color || cell.color || '#3b82f6';
    const bx = GRID_X + clampedStart * colW;
    const bw = spanCount * colW;
    const by = curY + 0.75;
    const bh = ROW_H - 1.5;

    fillRect(pdf, bx, by, bw, bh, bg);

    if (cell.value_text) {
      const fontSize = spanCount >= 3 ? 6 : spanCount === 2 ? 5 : 4;
      const labelColor = bandSpanTextColor(bg);
      txt(pdf, cell.value_text, bx + bw / 2, by + bh / 2, fontSize, labelColor, 'bold', {
        align: 'center',
        maxWidth: bw - 1,
      });
    }
  }
}

// ── Individual data cell ──────────────────────────────────────────────────────

function drawDataCell(pdf, { row, week, wi, cells, loadWaveData, x, curY, colW }) {
  const rk = rowMetricKey(row);
  const px = 1;
  const cw = colW - px * 2;
  const ch = ROW_H - px * 2;

  if (row.row_type === 'number') {
    const cell = findCell(row.id, week.monday, cells);
    const val = cell?.value_number ?? null;
    if (val != null) {
      const s = numberCellStyle(val);
      fillRect(pdf, x + px, curY + px, cw, ch, s.bg);
      txt(pdf, String(val), x + colW / 2, curY + ROW_H / 2, 6, s.text, 'bold', { align: 'center' });
    }
    return;
  }

  if (row.row_type === 'auto' && rk === 'acwr') {
    const raw = loadWaveData?.acwr?.[wi] ?? null;
    if (raw != null) {
      const s = acwrStyle(raw);
      fillRect(pdf, x + px, curY + px, cw, ch, s.bg);
      txt(pdf, raw.toFixed(2), x + colW / 2, curY + ROW_H / 2, 6, s.text, 'bold', { align: 'center' });
    }
    return;
  }

  if (row.row_type === 'auto') {
    const cell = findCell(row.id, week.monday, cells);
    const val = cell?.value_number ?? null;
    if (val != null) {
      const s = peakingStyle(val);
      fillRect(pdf, x + px, curY + px, cw, ch, s.bg);
      txt(pdf, String(val), x + colW / 2, curY + ROW_H / 2, 6, s.text, 'bold', { align: 'center' });
    }
    return;
  }

  if (row.row_type === 'marker') {
    const cell = findCell(row.id, week.monday, cells);
    if (cell) {
      const color = cell.value_color || cell.color || '#f97316';
      pdf.setFillColor(color);
      pdf.circle(x + colW / 2, curY + ROW_H / 2, 1, 'F');
    }
    return;
  }

  if (row.row_type === 'toggle') {
    const cell = findCell(row.id, week.monday, cells);
    if (toggleCellIsOn(cell)) {
      fillRect(pdf, x + 2, curY + 1, colW - 4, ROW_H - 2, '#22c55e');
      txt(pdf, 'ON', x + colW / 2, curY + ROW_H / 2, 5, '#ffffff', 'bold', { align: 'center' });
    }
  }
}

// ── Full grid for one page ────────────────────────────────────────────────────

function drawPDFGrid(pdf, { weeks, rows, cells, loadWaveData }) {
  const visibleRows = rows.filter((r) => r.is_visible !== false);
  const groups = groupRows(visibleRows);
  const colW = GRID_W / weeks.length;
  const gridRight = GRID_X + weeks.length * colW;

  let curY = HEADER_H + ORANGE_RULE_H;

  // ── Column header row ──────────────────────────────────────────────────────
  fillRect(pdf, MARGIN, curY, LABEL_COL, COL_HEADER_H, '#f3f4f6');
  txt(pdf, 'ROW / PERIOD', MARGIN + 2, curY + COL_HEADER_H / 2, 5, '#6b7280', 'bold');

  weeks.forEach((w, wi) => {
    const x = GRID_X + wi * colW;
    fillRect(pdf, x, curY, colW, COL_HEADER_H, '#f9fafb');
    const ds = new Date(w.monday + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    txt(pdf, ds, x + colW / 2, curY + COL_HEADER_H / 2, 5, '#6b7280', 'normal', { align: 'center' });
    line(pdf, x + colW, curY, x + colW, curY + COL_HEADER_H);
  });
  line(pdf, MARGIN, curY + COL_HEADER_H, gridRight, curY + COL_HEADER_H);
  line(pdf, GRID_X, curY, GRID_X, curY + COL_HEADER_H, '#e5e7eb', 0.4);

  curY += COL_HEADER_H;

  // ── Row groups ─────────────────────────────────────────────────────────────
  for (const { group, rows: gRows } of groups) {
    // Group header spanning full width
    fillRect(pdf, MARGIN, curY, LABEL_COL + GRID_W, GROUP_HEADER_H, '#f3f4f6');
    txt(pdf, group.toUpperCase(), MARGIN + 2, curY + GROUP_HEADER_H / 2, 5, '#6b7280', 'bold');
    weeks.forEach((w, wi) => {
      line(pdf, GRID_X + (wi + 1) * colW, curY, GRID_X + (wi + 1) * colW, curY + GROUP_HEADER_H);
    });
    line(pdf, GRID_X, curY, GRID_X, curY + GROUP_HEADER_H, '#e5e7eb', 0.4);
    line(pdf, MARGIN, curY + GROUP_HEADER_H, gridRight, curY + GROUP_HEADER_H);

    curY += GROUP_HEADER_H;

    for (const row of gRows) {
      // Label cell
      txt(pdf, row.label || '', MARGIN + 2, curY + ROW_H / 2, 6, '#111827', 'normal', {
        maxWidth: LABEL_COL - 4,
      });
      // Label-column right border
      line(pdf, GRID_X, curY, GRID_X, curY + ROW_H, '#e5e7eb', 0.4);

      // Week cells
      if (row.row_type === 'band' || row.row_type === 'text') {
        drawBandRow(pdf, { row, weeks, cells, curY, colW });
        weeks.forEach((w, wi) => {
          line(pdf, GRID_X + (wi + 1) * colW, curY, GRID_X + (wi + 1) * colW, curY + ROW_H);
        });
      } else {
        weeks.forEach((w, wi) => {
          const x = GRID_X + wi * colW;
          drawDataCell(pdf, { row, week: w, wi, cells, loadWaveData, x, curY, colW });
          line(pdf, x + colW, curY, x + colW, curY + ROW_H);
        });
      }

      // Row bottom border (full width)
      line(pdf, MARGIN, curY + ROW_H, gridRight, curY + ROW_H);
      curY += ROW_H;
    }
  }
}

// ── Load wave chart strip ─────────────────────────────────────────────────────

function drawLoadWaveChart(pdf, loadWaveImgBase64) {
  const y = PAGE_H - CHART_H;
  line(pdf, 0, y, PAGE_W, y, '#e5e7eb', 0.4);
  txt(pdf, 'LOAD WAVE', MARGIN, y + 4, 5, '#6b7280', 'bold');
  try {
    pdf.addImage(loadWaveImgBase64, 'PNG', MARGIN, y + 6, PAGE_W - MARGIN * 2, CHART_H - 6);
  } catch (err) {
    console.error('PDFExport: addImage loadWave failed', err);
  }
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {import('jspdf').jsPDF} p.pdf
 * @param {object} p.plan
 * @param {Array}  p.rows
 * @param {Array}  p.cells
 * @param {Array}  p.weeks
 * @param {string} [p.teamName]
 * @param {string} [p.teamLogoBase64]
 * @param {{ w: number, h: number } | null} [p.teamLogoDims]
 * @param {string} [p.loadWaveImgBase64]
 * @param {object} [p.loadWaveData]
 * @param {string|null} [p.athleteName]
 * @param {string|null} [p.athletePhotoBase64]
 * @param {string|null} [p.athletePosition]
 * @returns {Promise<import('jspdf').jsPDF>}
 */
export async function buildPeriodisationPDF({
  pdf,
  plan,
  rows,
  cells,
  weeks,
  teamName,
  teamLogoBase64,
  teamLogoDims,
  loadWaveImgBase64,
  loadWaveData,
  athleteName,
  athletePhotoBase64,
  athletePosition,
}) {
  const dateRange = formatDateRange(plan?.start_date, plan?.end_date);

  const chunks = [];
  for (let i = 0; i < weeks.length; i += WEEKS_PER_PAGE) {
    chunks.push(weeks.slice(i, i + WEEKS_PER_PAGE));
  }

  for (let pi = 0; pi < chunks.length; pi++) {
    const chunk = chunks[pi];
    const isLastPage = pi === chunks.length - 1;

    if (pi > 0) pdf.addPage();

    const pageStart = pi * WEEKS_PER_PAGE;
    const pageLoadWaveData = loadWaveData
      ? {
          acwr: loadWaveData.acwr?.slice(pageStart, pageStart + chunk.length) ?? [],
          volume: loadWaveData.volume?.slice(pageStart, pageStart + chunk.length) ?? [],
          intensity: loadWaveData.intensity?.slice(pageStart, pageStart + chunk.length) ?? [],
        }
      : null;

    try {
      drawHeader(pdf, {
        planName: plan?.name,
        teamName: teamName ?? '',
        dateRange,
        pageNum: pi + 1,
        totalPages: chunks.length,
        teamLogoBase64,
        teamLogoDims,
        athleteName: athleteName ?? null,
        athletePhotoBase64: athletePhotoBase64 ?? null,
        athletePosition: athletePosition ?? null,
      });
    } catch (err) {
      console.error('PDFExport: drawHeader failed on page', pi + 1, err);
    }

    try {
      drawPDFGrid(pdf, {
        weeks: chunk,
        rows,
        cells,
        loadWaveData: pageLoadWaveData,
        isLastPage,
      });
    } catch (err) {
      console.error('PDFExport: drawPDFGrid failed on page', pi + 1, err);
    }

    if (isLastPage && loadWaveImgBase64) {
      try {
        drawLoadWaveChart(pdf, loadWaveImgBase64);
      } catch (err) {
        console.error('PDFExport: drawLoadWaveChart failed', err);
      }
    }
  }

  return pdf;
}
