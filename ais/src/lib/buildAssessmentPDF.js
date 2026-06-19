/**
 * buildAssessmentPDF
 * Pure async function. Native jsPDF drawing only — no React, no DOM, no html2canvas.
 * Hex colours map 1-to-1 with index.css theme tokens.
 */
import { formatShortTestingDate } from './trendEngine';
import { IMPROVEMENT_COLORS, resolveTierHex, TIER_COLORS } from './chartColors';
import { athleteDisplayName } from './athleteName';
import {
  drawCircularPhoto,
  pdfFillRect,
  pdfLine,
  pdfText,
} from './pdfHelpers';

// ── Colours (layout chrome — not tier bands) ─────────────────────────────────
const C = {
  surface: '#131315',
  surfaceContainer: '#1f1f21',
  surfaceHigh: '#2a2a2c',
  onSurface: '#e4e2e4',
  onSurfaceVariant: '#e0c0b1',
  primary: '#F97316',
  error: '#ffb4ab',
  outlineVariant: '#584237',
};

const MARGIN = 15;
const HEADER_H = 22;
const FOOTER_H = 14;
const ORANGE_RULE = 0.6;

/** @deprecated portrait defaults — prefer getPageLayout(pdf) */
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_TOP = MARGIN + HEADER_H + ORANGE_RULE + 6;
const CONTENT_BOTTOM = PAGE_H - MARGIN - FOOTER_H;
const CONTENT_W = PAGE_W - MARGIN * 2;

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

function tierColorToHex(tierColorVar) {
  return resolveTierHex(tierColorVar);
}

function blendTierOnSurface(tierHex, surfaceHex = C.surfaceContainer, opacity = 0.18) {
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

/** Composite column — matches MatrixView TierValue mode="pill" (ordinal + tier on tinted background). */
function drawMatrixCompositePill(pdf, x, rowY, rowH, colW, percentile, tier, tierColorVar) {
  if (percentile == null || !tier) {
    pdfText(pdf, '—', x + colW / 2, rowY + rowH / 2, 7, C.onSurfaceVariant, 'normal', { align: 'center' });
    return;
  }
  const hex = tierColorToHex(tierColorVar);
  const label = `${formatOrdinal(percentile).toUpperCase()} - ${String(tier).toUpperCase()}`;
  const pillH = 5;
  const fontSize = 5.5;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(fontSize);
  const textW = pdf.getTextWidth(label);
  const pillW = Math.min(colW - 4, textW + 3);
  const pillX = x + (colW - pillW) / 2;
  const pillY = rowY + (rowH - pillH) / 2;
  pdfFillRect(pdf, pillX, pillY, pillW, pillH, blendTierOnSurface(hex));
  pdfText(pdf, label, pillX + pillW / 2, pillY + pillH / 2, fontSize, hex, 'bold', { align: 'center' });
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
  return delta > 0 ? TIER_COLORS.excellent : TIER_COLORS.belowAverage;
}

function imageFormat(base64) {
  if (base64?.startsWith('data:image/png')) return 'PNG';
  if (base64?.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

function fillPageBackground(pdf, layout) {
  pdfFillRect(pdf, 0, 0, layout.pageW, layout.pageH, C.surface);
}

function drawLogos(pdf, layout, { teamLogoBase64, teamLogoDims, aisLogoBase64, aisLogoDims }) {
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
        layout.pageW - MARGIN - lw,
        logoY,
        lw,
        logoH,
      );
    } catch { /* skip */ }
  }
}

function drawPageChrome(pdf, layout, { teamLogoBase64, teamLogoDims, aisLogoBase64, aisLogoDims }) {
  fillPageBackground(pdf, layout);
  drawLogos(pdf, layout, { teamLogoBase64, teamLogoDims, aisLogoBase64, aisLogoDims });
  pdfFillRect(pdf, 0, MARGIN + HEADER_H, layout.pageW, ORANGE_RULE, C.primary);
}

function drawFooters(pdf, layout, { signatoryName }) {
  const n = pdf.internal.getNumberOfPages();
  const signatory = [
    signatoryName ? `Prepared by ${signatoryName}` : null,
    'Athlete Intelligence System',
  ].filter(Boolean).join(' · ');

  for (let i = 1; i <= n; i += 1) {
    pdf.setPage(i);
    const footerY = layout.pageH - MARGIN;
    pdfFillRect(pdf, MARGIN, footerY - FOOTER_H, layout.contentW, FOOTER_H, C.surface);
    pdfLine(pdf, MARGIN, footerY - FOOTER_H + 2, layout.pageW - MARGIN, footerY - FOOTER_H + 2, C.outlineVariant, 0.2);
    if (signatory) {
      pdfText(pdf, signatory, layout.pageW - MARGIN, footerY - 5, 7, C.onSurfaceVariant, 'normal', { align: 'right' });
    }
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
    }
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
    pdfText(pag.pdf, 'v better', chartX + chartW, chartY - 2, 5, C.onSurfaceVariant, 'normal', { align: 'right' });
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

function drawSignedDeltaBarChart(pag, { title, progression, chartH: fixedChartH }) {
  if (!progression?.length) return;

  const rowH = 7;
  const chartH = fixedChartH ?? Math.max(50, progression.length * rowH + 20);
  pag.ensureSpace(chartH + 10);

  pdfText(pag.pdf, title, MARGIN, pag.y, 9, C.onSurface, 'bold');
  pag.advance(5);
  pdfText(
    pag.pdf,
    "Change between each athlete's two most recent available test dates",
    MARGIN,
    pag.y,
    6,
    C.onSurfaceVariant,
    'normal',
  );
  pag.advance(6);

  pdfText(pag.pdf, '■ Improved', MARGIN, pag.y, 6, IMPROVEMENT_COLORS.improved, 'bold');
  pdfText(pag.pdf, '■ Declined', MARGIN + 28, pag.y, 6, IMPROVEMENT_COLORS.declined, 'bold');
  pag.advance(6);

  const labelW = 42;
  const barAreaW = CONTENT_W - labelW - 4;
  const chartTop = pag.y;
  const maxAbs = Math.max(...progression.map((r) => Math.abs(r.delta ?? 0)), 0.001);

  progression.forEach((row, i) => {
    const rowY = chartTop + i * rowH;
    const name = row.athleteName ?? row.athlete?.full_name ?? 'Athlete';
    pdfText(pag.pdf, name, MARGIN, rowY + rowH / 2, 6, C.onSurface, 'normal', { maxWidth: labelW - 2 });

    const barX = MARGIN + labelW;
    const barH = 2.5;
    const delta = row.delta ?? 0;
    const barW = (Math.abs(delta) / maxAbs) * barAreaW * 0.5;
    const color = delta > 0 ? IMPROVEMENT_COLORS.improved : IMPROVEMENT_COLORS.declined;
    const startX = delta >= 0 ? barX + barAreaW * 0.5 : barX + barAreaW * 0.5 - barW;
    pdfFillRect(pag.pdf, startX, rowY + 1.5, Math.max(0.5, barW), barH, color);
  });

  pag.advance(chartH);
}

function drawEmptyState(pag, message) {
  pag.ensureSpace(12);
  pdfText(pag.pdf, message, MARGIN, pag.y, 10, C.onSurfaceVariant, 'normal');
  pag.advance(12);
}

function drawProgressMetric(pag, { label, count, total, x, y, w }) {
  const pct = total ? (count / total) * 100 : 0;
  pdfText(pag.pdf, label, x, y, 6, C.onSurfaceVariant, 'bold');
  pdfText(pag.pdf, `${count}/${total}`, x + w, y, 7, C.onSurface, 'bold', { align: 'right' });
  const barY = y + 4;
  pdfFillRect(pag.pdf, x, barY, w, 2, C.surfaceHigh);
  pdfFillRect(pag.pdf, x, barY, Math.max(0.5, (pct / 100) * w), 2, C.primary);
  return barY + 4;
}

function drawCoverageBody(pag, { coverageData, selectedTests, selectedTestingDates }) {
  const { dateSummaries, testDateMatrix, athleteRows } = coverageData ?? {};
  const testCount = selectedTests?.length ?? 0;

  if (!dateSummaries?.length && !testDateMatrix?.length) {
    drawEmptyState(pag, 'No coverage data for current filters.');
    return;
  }

  drawSectionTitle(pag, 'Per-date summary');
  for (const summary of dateSummaries ?? []) {
    pag.ensureSpace(28);
    const dateLabel = formatShortTestingDate(summary.session?.assessed_on);
    pdfText(pag.pdf, dateLabel.toUpperCase(), MARGIN, pag.y, 9, C.onSurface, 'bold');
    pag.advance(6);
    const cardY = pag.y;
    pdfFillRect(pag.pdf, MARGIN, cardY, CONTENT_W, 22, C.surfaceContainer);
    let metricY = cardY + 5;
    metricY = drawProgressMetric(pag, {
      label: 'TESTED (ANY DATA)',
      count: summary.testedCount,
      total: summary.squadSize,
      x: MARGIN + 3,
      y: metricY,
      w: CONTENT_W - 6,
    });
    drawProgressMetric(pag, {
      label: `FULLY TESTED (ALL ${testCount})`,
      count: summary.fullyTestedCount,
      total: summary.squadSize,
      x: MARGIN + 3,
      y: metricY,
      w: CONTENT_W - 6,
    });
    pag.y = cardY + 26;
  }
  pag.advance(4);

  const missingSections = (dateSummaries ?? []).filter((s) => s.missingAthletes?.length > 0);
  if (missingSections.length) {
    drawSectionTitle(pag, 'Missing athletes');
    for (const summary of missingSections) {
      pag.ensureSpace(14);
      const dateLabel = formatShortTestingDate(summary.session?.assessed_on);
      const missingCount = summary.missingAthletes.length;
      pdfText(
        pag.pdf,
        `${missingCount} athlete${missingCount === 1 ? '' : 's'} missing from ${dateLabel} entirely`,
        MARGIN,
        pag.y,
        8,
        C.onSurface,
        'bold',
      );
      pag.advance(5);
      const names = summary.missingAthletes.map((a) => athleteDisplayName(a)).join(', ');
      pag.pdf.setFont('helvetica', 'normal');
      pag.pdf.setFontSize(7);
      pag.pdf.setTextColor(C.onSurfaceVariant);
      const lines = pag.pdf.splitTextToSize(names, CONTENT_W);
      pag.ensureSpace(lines.length * 3.5 + 2);
      lines.forEach((line, i) => {
        pag.pdf.text(line, MARGIN, pag.y + i * 3.5);
      });
      pag.advance(lines.length * 3.5 + 4);
    }
  }

  const sortedDates = [...(selectedTestingDates ?? [])].sort(
    (a, b) => new Date(a.assessed_on) - new Date(b.assessed_on),
  );

  if (testDateMatrix?.length && sortedDates.length) {
    drawSectionTitle(pag, 'Coverage by test × testing date');
    const testColW = 44;
    const dateColW = Math.min(24, (CONTENT_W - testColW) / Math.max(sortedDates.length, 1));
    const headerH = 8;
    const rowH = 9;
    pag.ensureSpace(headerH);

    let x = MARGIN;
    pdfFillRect(pag.pdf, x, pag.y, testColW, headerH, C.surfaceHigh);
    pdfText(pag.pdf, 'Test', x + 2, pag.y + headerH / 2, 5, C.onSurfaceVariant, 'bold');
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
    pag.advance(headerH);

    for (const { test, cells } of testDateMatrix) {
      pag.ensureSpace(rowH);
      const rowY = pag.y;
      x = MARGIN;
      const cellBySession = Object.fromEntries(cells.map((c) => [c.sessionId, c]));
      pdfFillRect(pag.pdf, x, rowY, testColW, rowH, C.surfaceContainer);
      pdfText(pag.pdf, test.name, x + 2, rowY + rowH / 2, 6, C.onSurface, 'bold', { maxWidth: testColW - 4 });
      x += testColW;
      for (const session of sortedDates) {
        pdfFillRect(pag.pdf, x, rowY, dateColW, rowH, C.surfaceContainer);
        const cell = cellBySession[session.id];
        pdfText(
          pag.pdf,
          cell != null ? `${cell.pct}%` : '—',
          x + dateColW / 2,
          rowY + rowH / 2,
          7,
          C.onSurface,
          'normal',
          { align: 'center' },
        );
        x += dateColW;
      }
      pag.advance(rowH);
    }
    pag.advance(4);
  }

  const sortedAthleteRows = [...(athleteRows ?? [])].sort((a, b) => {
    if (a.overallRatio === b.overallRatio) return a.athleteName.localeCompare(b.athleteName);
    return b.overallRatio - a.overallRatio;
  });

  if (sortedAthleteRows.length && sortedDates.length) {
    drawSectionTitle(pag, 'Athlete-wise coverage');
    const nameColW = 38;
    const dateColW = Math.min(22, (CONTENT_W - nameColW - 28) / Math.max(sortedDates.length, 1));
    const overallColW = 28;
    const headerH = 8;
    const rowH = 9;
    pag.ensureSpace(headerH);

    let x = MARGIN;
    pdfFillRect(pag.pdf, x, pag.y, nameColW, headerH, C.surfaceHigh);
    pdfText(pag.pdf, 'Athlete', x + 2, pag.y + headerH / 2, 5, C.onSurfaceVariant, 'bold');
    x += nameColW;
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
    pdfFillRect(pag.pdf, x, pag.y, overallColW, headerH, C.surfaceHigh);
    pdfText(pag.pdf, 'Overall', x + overallColW / 2, pag.y + headerH / 2, 5, C.onSurfaceVariant, 'bold', { align: 'center' });
    pag.advance(headerH);

    for (const row of sortedAthleteRows) {
      pag.ensureSpace(rowH);
      const rowY = pag.y;
      x = MARGIN;
      pdfFillRect(pag.pdf, x, rowY, nameColW, rowH, C.surfaceContainer);
      pdfText(pag.pdf, row.athleteName, x + 2, rowY + rowH / 2, 6, C.onSurface, 'bold', { maxWidth: nameColW - 4 });
      x += nameColW;
      for (const session of sortedDates) {
        pdfFillRect(pag.pdf, x, rowY, dateColW, rowH, C.surfaceContainer);
        const completed = row.bySession[session.id] ?? 0;
        pdfText(
          pag.pdf,
          `${completed}/${testCount}`,
          x + dateColW / 2,
          rowY + rowH / 2,
          6,
          C.onSurface,
          'normal',
          { align: 'center' },
        );
        x += dateColW;
      }
      pdfFillRect(pag.pdf, x, rowY, overallColW, rowH, C.surfaceContainer);
      pdfText(
        pag.pdf,
        `${row.overallRaw}/${row.overallPossible} · ${row.overallPct}%`,
        x + 2,
        rowY + rowH / 2,
        5.5,
        C.onSurface,
        'normal',
        { maxWidth: overallColW - 4 },
      );
      pag.advance(rowH);
    }
    pag.advance(4);
  }
}

function rebalanceMatrixTestChunks(chunks, availableW) {
  if (chunks.length < 2) return chunks;

  const last = chunks[chunks.length - 1];
  if (last.tests.length >= 3) return chunks;

  const pageCount = chunks.length;
  const allTests = chunks.flatMap((chunk) => chunk.tests);
  const base = Math.floor(allTests.length / pageCount);
  const extra = allTests.length % pageCount;
  const { nameColW, compositeColW } = chunks[0];

  const rebalanced = [];
  let idx = 0;
  for (let page = 0; page < pageCount; page += 1) {
    const count = base + (page < extra ? 1 : 0);
    rebalanced.push({
      tests: allTests.slice(idx, idx + count),
      testColW: availableW / count,
      nameColW,
      compositeColW,
    });
    idx += count;
  }

  return rebalanced;
}

function splitMatrixTestColumns(selectedTests, contentW) {
  const nameColW = 36;
  const compositeColW = 30;
  const MIN_TEST_COL_W = 15;
  const fixedW = nameColW + compositeColW;
  const availableW = contentW - fixedW;
  const chunks = [];
  let idx = 0;

  while (idx < selectedTests.length) {
    const remaining = selectedTests.length - idx;
    const maxFit = Math.max(1, Math.floor(availableW / MIN_TEST_COL_W));
    const count = Math.min(remaining, maxFit);
    chunks.push({
      tests: selectedTests.slice(idx, idx + count),
      testColW: availableW / count,
      nameColW,
      compositeColW,
    });
    idx += count;
  }

  return rebalanceMatrixTestChunks(chunks, availableW);
}

function formatMatrixDelta(delta, unit) {
  if (delta == null || delta === 0) return null;
  const suffix = unit === 'seconds' || unit === 's' ? 's' : unit ? ` ${unit}` : '';
  return `${delta > 0 ? '+' : ''}${delta.toFixed(2)}${suffix}`;
}

function drawMatrixTableChunk(pag, sortedRows, chunk) {
  const { tests, testColW, nameColW, compositeColW } = chunk;
  const headerH = 10;
  const rowH = 12;

  pag.ensureSpace(headerH);
  let x = MARGIN;
  pdfFillRect(pag.pdf, x, pag.y, nameColW, headerH, C.surfaceHigh);
  pdfText(pag.pdf, 'Athlete', x + 2, pag.y + headerH / 2, 5, C.onSurfaceVariant, 'bold');
  x += nameColW;
  pdfFillRect(pag.pdf, x, pag.y, compositeColW, headerH, C.surfaceHigh);
  pdfText(pag.pdf, 'Composite', x + compositeColW / 2, pag.y + headerH / 2, 5, C.onSurfaceVariant, 'bold', { align: 'center' });
  x += compositeColW;
  for (const test of tests) {
    pdfFillRect(pag.pdf, x, pag.y, testColW, headerH, C.surfaceHigh);
    pdfText(
      pag.pdf,
      test.name,
      x + testColW / 2,
      pag.y + headerH / 2,
      4.5,
      C.onSurfaceVariant,
      'bold',
      { align: 'center', maxWidth: testColW - 2 },
    );
    x += testColW;
  }
  pag.advance(headerH);

  for (const row of sortedRows) {
    pag.ensureSpace(rowH);
    const rowY = pag.y;
    x = MARGIN;
    pdfFillRect(pag.pdf, x, rowY, nameColW, rowH, C.surfaceContainer);
    pdfText(
      pag.pdf,
      athleteDisplayName(row.athlete),
      x + 2,
      rowY + rowH / 2,
      6,
      C.onSurface,
      'bold',
      { maxWidth: nameColW - 4 },
    );
    x += nameColW;

    pdfFillRect(pag.pdf, x, rowY, compositeColW, rowH, C.surfaceContainer);
    drawMatrixCompositePill(
      pag.pdf,
      x,
      rowY,
      rowH,
      compositeColW,
      row.compositePercentile,
      row.compositeTier,
      row.compositeTierColor,
    );
    x += compositeColW;

    for (const test of tests) {
      pdfFillRect(pag.pdf, x, rowY, testColW, rowH, C.surfaceContainer);
      const cell = row.tests?.[test.id];
      const unit = test.unit === 'seconds' ? 's' : test.unit;
      const cellCenterX = x + testColW / 2;
      if (cell?.latestValue != null) {
        const valueHex = cell.tierColor ? tierColorToHex(cell.tierColor) : C.onSurface;
        const deltaStr = formatMatrixDelta(cell.delta, unit);
        const valueY = deltaStr ? rowY + 4.5 : rowY + rowH / 2;
        pdfText(pag.pdf, formatValue(cell.latestValue, unit), cellCenterX, valueY, 6, valueHex, 'bold', {
          align: 'center',
          maxWidth: testColW - 4,
        });
        if (deltaStr) {
          pdfText(pag.pdf, deltaStr, cellCenterX, rowY + 9, 5, deltaColor(cell.delta), 'bold', {
            align: 'center',
            maxWidth: testColW - 4,
          });
        }
      } else {
        pdfText(pag.pdf, '—', cellCenterX, rowY + rowH / 2, 7, C.onSurfaceVariant, 'normal', { align: 'center' });
      }
      x += testColW;
    }
    pag.advance(rowH);
  }
  pag.advance(4);
}

function drawMatrixBody(pag, { matrixRows, selectedTests }) {
  if (!selectedTests?.length) {
    drawEmptyState(pag, 'Select tests to export the matrix.');
    return;
  }

  const sortedRows = [...(matrixRows ?? [])].sort((a, b) => {
    const aVal = a.compositePercentile;
    const bVal = b.compositePercentile;
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    return bVal - aVal;
  });

  if (!sortedRows.length) {
    drawEmptyState(pag, 'No matrix data for current filters.');
    return;
  }

  const contentW = pag.layout.contentW;
  const chunks = splitMatrixTestColumns(selectedTests, contentW);

  chunks.forEach((chunk, chunkIdx) => {
    if (chunkIdx > 0) pag.newPage();
    const title = chunks.length > 1
      ? `Squad matrix (${chunkIdx + 1}/${chunks.length})`
      : 'Squad matrix';
    drawSectionTitle(pag, title);
    drawMatrixTableChunk(pag, sortedRows, chunk);
  });
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
  const { squadTestMultiples, selectedTests } = payload;

  const multiplesEntries = (selectedTests ?? []).filter((test) => {
    const progression = squadTestMultiples?.[test.id];
    return progression?.length > 0;
  });

  if (!multiplesEntries.length) {
    drawEmptyState(pag, 'No improvement data for selected tests.');
    return;
  }

  for (const test of multiplesEntries) {
    if (pag.y > pag.layout.contentTop + 20) pag.newPage();
    drawSignedDeltaBarChart(pag, {
      title: test.name,
      progression: squadTestMultiples[test.id],
    });
    pag.advance(6);
  }
}

/**
 * @param {object} p
 * @param {import('jspdf').jsPDF} p.pdf
 * @param {'athlete'|'team'|'matrix'|'coverage'} p.mode
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
  squadTestMultiples,
  coverageData,
  matrixRows,
}) {
  const chrome = { teamLogoBase64, teamLogoDims, aisLogoBase64, aisLogoDims };
  const layout = getPageLayout(pdf);

  drawPageChrome(pdf, layout, chrome);
  const pag = createPaginator(pdf, layout, chrome);

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
  } else if (mode === 'coverage') {
    drawTeamHeaderBlock(pag, teamName);
    drawCoverageBody(pag, { coverageData, selectedTests, selectedTestingDates });
  } else if (mode === 'matrix') {
    drawTeamHeaderBlock(pag, teamName);
    drawMatrixBody(pag, { matrixRows, selectedTests });
  } else {
    drawTeamHeaderBlock(pag, teamName);
    drawTeamBody(pag, {
      squadTestMultiples,
      selectedTests,
    });
  }

  drawFooters(pdf, layout, { signatoryName });
  return pdf;
}
