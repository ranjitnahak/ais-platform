/**
 * buildAssessmentPDF
 * Pure async function. Native jsPDF drawing only — no React, no DOM, no html2canvas.
 * Hex colours map 1-to-1 with index.css theme tokens.
 */
import { formatShortTestingDate } from './trendEngine';
import {
  drawCircularPhoto,
  pdfFillRect,
  pdfLine,
  pdfText,
} from './pdfHelpers';

// ── Colours (resolved from index.css) ───────────────────────────────────────
const C = {
  surface: '#131315',
  surfaceContainer: '#1f1f21',
  surfaceHigh: '#2a2a2c',
  onSurface: '#e4e2e4',
  onSurfaceVariant: '#e0c0b1',
  primary: '#F97316',
  belowAvg: '#93000a',
  avg: '#F97316',
  aboveAvg: '#3b82f6',
  excellent: '#22c55e',
  error: '#ffb4ab',
  outlineVariant: '#584237',
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const HEADER_H = 22;
const FOOTER_H = 14;
const ORANGE_RULE = 0.6;
const CONTENT_TOP = MARGIN + HEADER_H + ORANGE_RULE + 6;
const CONTENT_BOTTOM = PAGE_H - MARGIN - FOOTER_H;
const CONTENT_W = PAGE_W - MARGIN * 2;

function tierColorToHex(tierColorVar) {
  if (!tierColorVar) return C.avg;
  const key = String(tierColorVar)
    .replace('--color-', '')
    .replace(/-/g, '')
    .toLowerCase();
  const map = {
    belowavg: C.belowAvg,
    errorcontainer: C.belowAvg,
    avg: C.avg,
    primarycontainer: C.avg,
    aboveavg: C.aboveAvg,
    secondarycontainer: C.aboveAvg,
    excellent: C.excellent,
    tertiarycontainer: C.excellent,
    outline: C.onSurfaceVariant,
  };
  return map[key] ?? C.avg;
}

function formatOrdinal(n) {
  if (n == null) return '';
  const rounded = Math.round(n);
  const mod10 = rounded % 10;
  const mod100 = rounded % 100;
  let suffix = 'th';
  if (mod10 === 1 && mod100 !== 11) suffix = 'st';
  else if (mod10 === 2 && mod100 !== 12) suffix = 'nd';
  else if (mod10 === 3 && mod100 !== 13) suffix = 'rd';
  return `${rounded}${suffix}`;
}

function formatValue(value, unit) {
  if (value == null) return '—';
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (!unit) return formatted;
  return unit === 'seconds' ? `${formatted}s` : `${formatted} ${unit}`;
}

function deltaColor(delta) {
  if (delta == null || delta === 0) return C.onSurfaceVariant;
  return delta > 0 ? C.excellent : C.error;
}

function imageFormat(base64) {
  if (base64?.startsWith('data:image/png')) return 'PNG';
  if (base64?.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

function fillPageBackground(pdf) {
  pdfFillRect(pdf, 0, 0, PAGE_W, PAGE_H, C.surface);
}

function drawLogos(pdf, { teamLogoBase64, teamLogoDims, aisLogoBase64, aisLogoDims }) {
  const logoH = 10;
  const logoY = MARGIN + (HEADER_H - logoH) / 2;

  if (teamLogoBase64 && teamLogoDims?.w > 0 && teamLogoDims?.h > 0) {
    const lw = Math.min((teamLogoDims.w / teamLogoDims.h) * logoH, 36);
    try {
      pdf.addImage(teamLogoBase64, imageFormat(teamLogoBase64), MARGIN, logoY, lw, logoH);
    } catch { /* skip */ }
  }

  if (aisLogoBase64 && aisLogoDims?.w > 0 && aisLogoDims?.h > 0) {
    const lw = Math.min((aisLogoDims.w / aisLogoDims.h) * logoH, 36);
    try {
      pdf.addImage(
        aisLogoBase64,
        imageFormat(aisLogoBase64),
        PAGE_W - MARGIN - lw,
        logoY,
        lw,
        logoH,
      );
    } catch { /* skip */ }
  }
}

function drawPageChrome(pdf, { teamLogoBase64, teamLogoDims, aisLogoBase64, aisLogoDims }) {
  fillPageBackground(pdf);
  drawLogos(pdf, { teamLogoBase64, teamLogoDims, aisLogoBase64, aisLogoDims });
  pdfFillRect(pdf, 0, MARGIN + HEADER_H, PAGE_W, ORANGE_RULE, C.primary);
}

function drawFooters(pdf, { signatoryName, signatoryTitle }) {
  const n = pdf.internal.getNumberOfPages();
  const signatory = [
    signatoryName ? `Prepared by ${signatoryName}` : null,
    signatoryTitle,
    'Athlete Intelligence System',
  ].filter(Boolean).join(' · ');

  for (let i = 1; i <= n; i += 1) {
    pdf.setPage(i);
    const footerY = PAGE_H - MARGIN;
    pdfFillRect(pdf, MARGIN, footerY - FOOTER_H, CONTENT_W, FOOTER_H, C.surface);
    pdfLine(pdf, MARGIN, footerY - FOOTER_H + 2, PAGE_W - MARGIN, footerY - FOOTER_H + 2, C.outlineVariant, 0.2);
    if (signatory) {
      pdfText(pdf, signatory, PAGE_W - MARGIN, footerY - 5, 7, C.onSurfaceVariant, 'normal', { align: 'right' });
    }
    pdfText(pdf, `Page ${i} of ${n}`, PAGE_W - MARGIN, footerY - 1, 7, C.onSurface, 'bold', { align: 'right' });
  }
}

function createPaginator(pdf, chrome) {
  let y = CONTENT_TOP;

  function newPage() {
    pdf.addPage();
    drawPageChrome(pdf, chrome);
    y = CONTENT_TOP;
  }

  function ensureSpace(needed) {
    if (y + needed > CONTENT_BOTTOM) {
      newPage();
    }
  }

  return {
    pdf,
    get y() { return y; },
    set y(v) { y = v; },
    ensureSpace,
    newPage,
    advance(dy) { y += dy; },
  };
}

function drawSectionTitle(pag, title) {
  pag.ensureSpace(10);
  pdfText(pag.pdf, title.toUpperCase(), MARGIN, pag.y, 8, C.onSurfaceVariant, 'bold');
  pag.advance(8);
}

function drawTierPill(pdf, x, y, tierName, tierColorVar, maxW = 28) {
  if (!tierName || tierName === 'Unclassified') {
    pdfText(pdf, '—', x, y, 7, C.onSurfaceVariant, 'normal');
    return;
  }
  const bg = tierColorToHex(tierColorVar);
  const pillW = Math.min(maxW, tierName.length * 1.8 + 4);
  pdfFillRect(pdf, x, y - 3, pillW, 5, bg);
  pdfText(pdf, tierName, x + pillW / 2, y, 6, C.onSurface, 'bold', { align: 'center' });
}

function drawAthleteHeaderBlock(pag, {
  athleteName,
  athletePosition,
  athleteAge,
  teamName,
  athletePhotoBase64,
}) {
  const { pdf } = pag;
  pag.ensureSpace(28);
  const photoSize = 18;
  const photoX = MARGIN;
  const photoY = pag.y;

  const parts = (athleteName ?? '').trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();

  drawCircularPhoto(pdf, {
    base64: athletePhotoBase64,
    x: photoX,
    y: photoY,
    sizeMm: photoSize,
    borderHex: C.primary,
    initials,
    initialsColor: C.onSurface,
    initialsBg: C.surfaceHigh,
  });

  const textX = photoX + photoSize + 5;
  pdfText(pdf, athleteName ?? '', textX, photoY + 5, 14, C.onSurface, 'bold');
  const meta = [
    athletePosition || null,
    athleteAge != null ? `Age ${athleteAge}` : null,
    teamName || null,
  ].filter(Boolean).join(' · ');
  if (meta) {
    pdfText(pdf, meta, textX, photoY + 12, 9, C.onSurfaceVariant, 'normal');
  }
  pag.advance(photoSize + 6);
}

function drawTeamHeaderBlock(pag, teamName) {
  const { pdf } = pag;
  pag.ensureSpace(16);
  pdfText(pdf, (teamName ?? 'Team').toUpperCase(), MARGIN, pag.y + 4, 14, C.onSurface, 'bold');
  pag.advance(14);
}

function drawSummaryCards(pag, { selectedTests, individualProgressions, summaryCardPercentiles }) {
  if (!selectedTests?.length) return;
  drawSectionTitle(pag, 'Test summary');

  const cols = 2;
  const gap = 4;
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cardH = 22;
  let col = 0;
  let rowY = pag.y;

  for (const test of selectedTests) {
    if (col === 0) pag.ensureSpace(cardH + gap);

    const x = MARGIN + col * (cardW + gap);
    const y = rowY;
    pdfFillRect(pag.pdf, x, y, cardW, cardH, C.surfaceContainer);
    pdfLine(pag.pdf, x, y, x + cardW, y, C.outlineVariant, 0.15);
    pdfLine(pag.pdf, x, y + cardH, x + cardW, y + cardH, C.outlineVariant, 0.15);
    pdfLine(pag.pdf, x, y, x, y + cardH, C.outlineVariant, 0.15);
    pdfLine(pag.pdf, x + cardW, y, x + cardW, y + cardH, C.outlineVariant, 0.15);

    const progression = individualProgressions?.[test.id];
    const lastPoint = progression?.dataPoints?.[progression.dataPoints.length - 1];
    const percentile = summaryCardPercentiles?.[test.id];
    const delta = progression?.overallDelta;

    pdfText(pag.pdf, test.name, x + 3, y + 5, 7, C.onSurfaceVariant, 'bold');
    const valueStr = formatValue(lastPoint?.value, test.unit === 'seconds' ? 'seconds' : test.unit);
    const pctStr = percentile?.percentile != null
      ? ` — ${formatOrdinal(percentile.percentile)} percentile (team)`
      : '';
    pdfText(pag.pdf, `${valueStr}${pctStr}`, x + 3, y + 11, 8, C.onSurface, 'bold', { maxWidth: cardW - 6 });

    const deltaStr = delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}` : '—';
    pdfText(pag.pdf, deltaStr, x + 3, y + 17, 10, deltaColor(delta), 'bold');

    col += 1;
    if (col >= cols) {
      col = 0;
      rowY += cardH + gap;
      pag.y = rowY;
    }
  }
  if (col > 0) pag.y = rowY + cardH + 4;
  else pag.advance(4);
}

function drawCompositeTrend(pag, compositeClassification) {
  if (!compositeClassification?.progression?.length) return;
  drawSectionTitle(pag, 'Overall classification');

  for (const point of compositeClassification.progression) {
    pag.ensureSpace(8);
    const dateLabel = formatShortTestingDate(point.date);
    if (point.percentile != null) {
      const line = `${dateLabel}: ${formatOrdinal(point.percentile)} percentile (${point.tierName ?? '—'})`;
      pdfText(pag.pdf, line, MARGIN, pag.y, 9, C.onSurface, 'bold');
      drawTierPill(pag.pdf, MARGIN + CONTENT_W - 30, pag.y, point.tierName, point.tierColor, 30);
    } else {
      pdfText(pag.pdf, `${dateLabel}: —`, MARGIN, pag.y, 9, C.onSurfaceVariant, 'normal');
    }
    pag.advance(7);
  }

  const { overallDelta } = compositeClassification;
  if (overallDelta != null) {
    pag.ensureSpace(8);
    const deltaStr = `${overallDelta > 0 ? '+' : ''}${overallDelta.toFixed(1)}`;
    pdfText(pag.pdf, `Overall Δ: ${deltaStr}`, MARGIN, pag.y, 10, deltaColor(overallDelta), 'bold');
    pag.advance(8);
  }
  pag.advance(4);
}

function drawLineChart(pag, {
  title,
  dataPoints,
  unit,
  benchmarkTiers,
  direction,
  chartH = 45,
}) {
  if (!dataPoints?.length) return;
  pag.ensureSpace(chartH + 14);
  pdfText(pag.pdf, title, MARGIN, pag.y, 9, C.onSurface, 'bold');
  pag.advance(6);

  const chartX = MARGIN + 12;
  const chartY = pag.y;
  const chartW = CONTENT_W - 14;
  const innerH = chartH - 10;

  const values = dataPoints.map((p) => p.value).filter((v) => v != null);
  if (!values.length) {
    pag.advance(chartH);
    return;
  }

  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  const pad = (yMax - yMin) * 0.1 || 1;
  yMin -= pad;
  yMax += pad;
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }

  pdfLine(pag.pdf, chartX, chartY, chartX, chartY + innerH, C.outlineVariant, 0.2);
  pdfLine(pag.pdf, chartX, chartY + innerH, chartX + chartW, chartY + innerH, C.outlineVariant, 0.2);

  const tiers = [...(benchmarkTiers ?? [])].sort((a, b) => a.tier_order - b.tier_order);
  for (const tier of tiers) {
    const tMin = tier.threshold_min ?? yMin;
    const tMax = tier.threshold_max ?? yMax;
    const bandTop = chartY + innerH - ((tMax - yMin) / (yMax - yMin)) * innerH;
    const bandBottom = chartY + innerH - ((tMin - yMin) / (yMax - yMin)) * innerH;
    const bandH = Math.max(0.5, bandBottom - bandTop);
    const bg = tierColorToHex(tier.tier_color);
    pdfFillRect(pag.pdf, chartX + 0.5, bandTop, chartW - 1, bandH, bg);
  }

  const n = dataPoints.length;
  const points = dataPoints.map((p, i) => {
    const px = chartX + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW);
    const py = chartY + innerH - ((p.value - yMin) / (yMax - yMin)) * innerH;
    return { px, py, point: p };
  });

  for (let i = 1; i < points.length; i += 1) {
    pdfLine(pag.pdf, points[i - 1].px, points[i - 1].py, points[i].px, points[i].py, C.primary, 0.4);
  }

  for (const { px, py, point } of points) {
    pag.pdf.setFillColor(C.primary);
    pag.pdf.circle(px, py, 1.2, 'F');
    const label = formatShortTestingDate(point.date);
    pdfText(pag.pdf, label, px, chartY + innerH + 4, 6, C.onSurfaceVariant, 'normal', { align: 'center' });
  }

  pdfText(pag.pdf, formatValue(yMax, unit), chartX - 2, chartY + 2, 6, C.onSurfaceVariant, 'normal', { align: 'right' });
  pdfText(pag.pdf, formatValue(yMin, unit), chartX - 2, chartY + innerH, 6, C.onSurfaceVariant, 'normal', { align: 'right' });

  if (direction === 'lower_is_better') {
    pdfText(pag.pdf, '↓ better', chartX + chartW, chartY - 2, 5, C.onSurfaceVariant, 'normal', { align: 'right' });
  }

  pag.advance(chartH + 6);
}

function drawProgressionTable(pag, {
  selectedTests,
  selectedTestingDates,
  individualProgressions,
}) {
  if (!selectedTests?.length || !selectedTestingDates?.length) return;

  const sortedDates = [...selectedTestingDates].sort(
    (a, b) => new Date(a.assessed_on) - new Date(b.assessed_on),
  );
  const dateColW = Math.min(28, (CONTENT_W - 40) / Math.max(sortedDates.length, 1));
  const testColW = 40;
  const deltaColW = 22;
  const rowH = 12;
  const headerH = 8;

  drawSectionTitle(pag, 'Progression table');
  pag.ensureSpace(headerH + rowH);

  let x = MARGIN;
  pdfFillRect(pag.pdf, x, pag.y, testColW, headerH, C.surfaceHigh);
  pdfText(pag.pdf, 'Test', x + 2, pag.y + headerH / 2, 6, C.onSurfaceVariant, 'bold');
  x += testColW;

  for (const session of sortedDates) {
    pdfFillRect(pag.pdf, x, pag.y, dateColW, headerH, C.surfaceHigh);
    pdfText(
      pag.pdf,
      formatShortTestingDate(session.assessed_on),
      x + dateColW / 2,
      pag.y + headerH / 2,
      5,
      C.onSurfaceVariant,
      'bold',
      { align: 'center' },
    );
    x += dateColW;
  }

  pdfFillRect(pag.pdf, x, pag.y, deltaColW, headerH, C.surfaceHigh);
  pdfText(pag.pdf, 'Overall Δ', x + deltaColW / 2, pag.y + headerH / 2, 5, C.onSurfaceVariant, 'bold', { align: 'center' });

  pag.advance(headerH);

  for (const test of selectedTests) {
    pag.ensureSpace(rowH);
    const rowY = pag.y;
    x = MARGIN;

    pdfFillRect(pag.pdf, x, rowY, testColW, rowH, C.surfaceContainer);
    pdfText(pag.pdf, test.name, x + 2, rowY + rowH / 2, 7, C.onSurface, 'bold', { maxWidth: testColW - 4 });
    x += testColW;

    const progression = individualProgressions?.[test.id];
    const pointsBySession = Object.fromEntries(
      (progression?.dataPoints ?? []).map((p) => [p.sessionId, p]),
    );
    const unit = test.unit === 'seconds' ? 'seconds' : test.unit;

    for (const session of sortedDates) {
      pdfFillRect(pag.pdf, x, rowY, dateColW, rowH, C.surfaceContainer);
      const point = pointsBySession[session.id];
      if (point) {
        pdfText(pag.pdf, formatValue(point.value, unit), x + 2, rowY + 4, 7, C.onSurface, 'bold');
        drawTierPill(pag.pdf, x + 2, rowY + 9, point.tierName, point.tierColor, dateColW - 4);
      } else {
        pdfText(pag.pdf, '—', x + dateColW / 2, rowY + rowH / 2, 7, C.onSurfaceVariant, 'normal', { align: 'center' });
      }
      x += dateColW;
    }

    pdfFillRect(pag.pdf, x, rowY, deltaColW, rowH, C.surfaceContainer);
    const delta = progression?.overallDelta;
    const deltaStr = delta != null
      ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}${unit === 'seconds' ? 's' : unit ? ` ${unit}` : ''}`
      : '—';
    pdfText(
      pag.pdf,
      deltaStr,
      x + deltaColW / 2,
      rowY + rowH / 2,
      7,
      deltaColor(delta),
      'bold',
      { align: 'center' },
    );

    pag.advance(rowH);
  }
  pag.advance(4);
}

function drawHorizontalBarChart(pag, {
  title,
  squadProgression,
  test,
  firstDateLabel,
  lastDateLabel,
  colorLastBarByDelta = false,
  chartH: fixedChartH,
}) {
  if (!squadProgression?.length) return;

  const rowH = 7;
  const chartH = fixedChartH ?? Math.max(50, squadProgression.length * rowH + 16);
  pag.ensureSpace(chartH + 10);

  pdfText(pag.pdf, title, MARGIN, pag.y, 9, C.onSurface, 'bold');
  pag.advance(5);

  pdfText(pag.pdf, `■ ${firstDateLabel ?? 'First'}`, MARGIN, pag.y, 6, C.aboveAvg, 'bold');
  pdfText(pag.pdf, `■ ${lastDateLabel ?? 'Last'}`, MARGIN + 40, pag.y, 6, C.primary, 'bold');
  pag.advance(6);

  const labelW = 42;
  const barAreaW = CONTENT_W - labelW - 4;
  const chartTop = pag.y;

  const allValues = squadProgression.flatMap((r) => [r.firstValue, r.lastValue]).filter((v) => v != null);
  let vMin = Math.min(...allValues);
  let vMax = Math.max(...allValues);
  if (vMin === vMax) {
    vMin -= 1;
    vMax += 1;
  }

  const lowerBetter = test?.direction === 'lower_is_better';

  squadProgression.forEach((row, i) => {
    const rowY = chartTop + i * rowH;
    const name = row.athleteName ?? row.athlete?.full_name ?? 'Athlete';
    pdfText(pag.pdf, name, MARGIN, rowY + rowH / 2, 6, C.onSurface, 'normal', { maxWidth: labelW - 2 });

    const barX = MARGIN + labelW;
    const barH = 2.2;
    const gap = 0.8;

    const toBarW = (val) => {
      const norm = (val - vMin) / (vMax - vMin);
      const w = lowerBetter ? (1 - norm) * barAreaW * 0.45 : norm * barAreaW * 0.45;
      return Math.max(1, w);
    };

    const firstW = toBarW(row.firstValue);
    pdfFillRect(pag.pdf, barX, rowY + 1, firstW, barH, C.aboveAvg);

    let lastColor = C.primary;
    if (colorLastBarByDelta) {
      lastColor = row.delta > 0 ? C.excellent : row.delta < 0 ? C.belowAvg : C.avg;
    }
    const lastW = toBarW(row.lastValue);
    pdfFillRect(pag.pdf, barX, rowY + 1 + barH + gap, lastW, barH, lastColor);
  });

  pag.advance(chartH);
}

function drawSquadTable(pag, { squadTableRows, test }) {
  if (!squadTableRows?.length) return;

  const unit = test?.unit === 'seconds' ? 's' : test?.unit;
  const cols = [
    { label: 'Athlete', w: 38 },
    { label: 'First', w: 18 },
    { label: 'Last', w: 18 },
    { label: 'Raw Δ', w: 18 },
    { label: 'Pct Δ', w: 16 },
    { label: 'Composite', w: 22 },
    { label: 'Tier', w: 28 },
  ];
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const scale = CONTENT_W / totalW;
  const scaledCols = cols.map((c) => ({ ...c, w: c.w * scale }));

  const headerH = 8;
  const rowH = 10;

  drawSectionTitle(pag, 'Squad comparison table');
  pag.ensureSpace(headerH);

  let x = MARGIN;
  for (const col of scaledCols) {
    pdfFillRect(pag.pdf, x, pag.y, col.w, headerH, C.surfaceHigh);
    pdfText(pag.pdf, col.label, x + col.w / 2, pag.y + headerH / 2, 5, C.onSurfaceVariant, 'bold', { align: 'center' });
    x += col.w;
  }
  pag.advance(headerH);

  for (const row of squadTableRows) {
    pag.ensureSpace(rowH);
    const rowY = pag.y;
    x = MARGIN;

    const name = row.athlete?.full_name ?? row.athleteName ?? '—';
    pdfFillRect(pag.pdf, x, rowY, scaledCols[0].w, rowH, C.surfaceContainer);
    pdfText(pag.pdf, name, x + 2, rowY + rowH / 2, 6, C.onSurface, 'bold', { maxWidth: scaledCols[0].w - 4 });
    x += scaledCols[0].w;

    const cells = [
      formatValue(row.firstValue, unit),
      formatValue(row.lastValue, unit),
      row.delta != null ? `${row.delta > 0 ? '+' : ''}${row.delta.toFixed(2)}${unit ? (unit === 's' ? 's' : ` ${unit}`) : ''}` : '—',
      row.percentileDelta != null ? `${row.percentileDelta > 0 ? '+' : ''}${row.percentileDelta.toFixed(1)}` : '—',
      row.compositePercentile != null
        ? `${formatOrdinal(row.compositePercentile)}${row.compositeTier ? ` (${row.compositeTier})` : ''}`
        : '—',
      row.tierChanged ? `${row.firstTierName ?? '—'} → ${row.lastTierName ?? '—'}` : 'No change',
    ];

    const cellColors = [
      C.onSurface,
      C.onSurface,
      deltaColor(row.delta),
      deltaColor(row.percentileDelta),
      C.onSurface,
      C.onSurfaceVariant,
    ];

    for (let i = 0; i < cells.length; i += 1) {
      const col = scaledCols[i + 1];
      pdfFillRect(pag.pdf, x, rowY, col.w, rowH, C.surfaceContainer);
      pdfText(pag.pdf, cells[i], x + 2, rowY + rowH / 2, 5.5, cellColors[i], i < 2 ? 'bold' : 'normal', { maxWidth: col.w - 4 });
      x += col.w;
    }
    pag.advance(rowH);
  }
  pag.advance(4);
}

function drawEmptyState(pag, message) {
  pag.ensureSpace(12);
  pdfText(pag.pdf, message, MARGIN, pag.y, 10, C.onSurfaceVariant, 'normal');
  pag.advance(12);
}

function drawAthleteBody(pag, payload) {
  const {
    selectedTests,
    individualProgressions,
    summaryCardPercentiles,
    compositeClassification,
    benchmarkTiersByTest,
    selectedTestingDates,
  } = payload;

  if (!selectedTests?.length) {
    drawEmptyState(pag, 'No tests selected for export.');
    return;
  }

  drawSummaryCards(pag, { selectedTests, individualProgressions, summaryCardPercentiles });
  drawCompositeTrend(pag, compositeClassification);

  drawSectionTitle(pag, 'Per-test trends');
  for (const test of selectedTests) {
    drawLineChart(pag, {
      title: test.name,
      dataPoints: individualProgressions?.[test.id]?.dataPoints,
      unit: test.unit,
      benchmarkTiers: benchmarkTiersByTest?.[test.id],
      direction: test.direction,
    });
  }

  drawProgressionTable(pag, {
    selectedTests,
    selectedTestingDates,
    individualProgressions,
  });
}

function drawTeamBody(pag, payload) {
  const {
    squadTest,
    firstDateLabel,
    lastDateLabel,
    squadProgression,
    squadTableRows,
    squadTestMultiples,
    tests,
    allSessions,
  } = payload;

  if (squadTest) {
    pag.ensureSpace(10);
    pdfText(pag.pdf, squadTest.name, MARGIN, pag.y, 11, C.onSurface, 'bold');
  }
  if (firstDateLabel || lastDateLabel) {
    pag.advance(6);
    pdfText(pag.pdf, [firstDateLabel, lastDateLabel].filter(Boolean).join(' — '), MARGIN, pag.y, 8, C.onSurfaceVariant, 'normal');
    pag.advance(8);
  }

  if (!squadProgression?.length && !squadTableRows?.length) {
    drawEmptyState(pag, 'No squad data for current filters.');
  } else {
    drawHorizontalBarChart(pag, {
      title: `Squad comparison — ${squadTest?.name ?? 'Test'}`,
      squadProgression,
      test: squadTest,
      firstDateLabel,
      lastDateLabel,
    });
    drawSquadTable(pag, { squadTableRows, test: squadTest });
  }

  const multiplesEntries = (tests ?? []).filter((test) => {
    const progression = squadTestMultiples?.[test.id];
    return progression?.length > 0;
  });

  for (const test of multiplesEntries) {
    pag.newPage();
    const progression = squadTestMultiples[test.id];
    const firstLabel = allSessions?.find((s) => s.id === progression[0]?.firstSessionId);
    const lastLabel = allSessions?.find((s) => s.id === progression[0]?.lastSessionId);
    drawHorizontalBarChart(pag, {
      title: test.name,
      squadProgression: progression,
      test,
      firstDateLabel: firstLabel ? formatShortTestingDate(firstLabel.assessed_on) : '',
      lastDateLabel: lastLabel ? formatShortTestingDate(lastLabel.assessed_on) : '',
      colorLastBarByDelta: true,
    });
  }
}

/**
 * @param {object} p
 * @param {import('jspdf').jsPDF} p.pdf
 * @param {'athlete'|'team'} p.mode
 * @returns {Promise<import('jspdf').jsPDF>}
 */
export async function buildAssessmentPDF({
  pdf,
  mode,
  teamName,
  teamLogoBase64,
  teamLogoDims,
  aisLogoBase64,
  aisLogoDims,
  signatoryName,
  signatoryTitle,
  athleteName,
  athletePosition,
  athleteAge,
  athletePhotoBase64,
  selectedTests,
  summaryCardPercentiles,
  compositeClassification,
  individualProgressions,
  benchmarkTiersByTest,
  selectedTestingDates,
  squadTest,
  firstDateLabel,
  lastDateLabel,
  squadProgression,
  squadTableRows,
  squadTestMultiples,
  tests,
  allSessions,
}) {
  const chrome = { teamLogoBase64, teamLogoDims, aisLogoBase64, aisLogoDims };

  drawPageChrome(pdf, chrome);
  const pag = createPaginator(pdf, chrome);

  if (mode === 'athlete') {
    drawAthleteHeaderBlock(pag, {
      athleteName,
      athletePosition,
      athleteAge,
      teamName,
      athletePhotoBase64,
    });
    drawAthleteBody(pag, {
      selectedTests,
      individualProgressions,
      summaryCardPercentiles,
      compositeClassification,
      benchmarkTiersByTest,
      selectedTestingDates,
    });
  } else {
    drawTeamHeaderBlock(pag, teamName);
    drawTeamBody(pag, {
      squadTest,
      firstDateLabel,
      lastDateLabel,
      squadProgression,
      squadTableRows,
      squadTestMultiples,
      tests,
      allSessions,
    });
  }

  drawFooters(pdf, { signatoryName, signatoryTitle });
  return pdf;
}
