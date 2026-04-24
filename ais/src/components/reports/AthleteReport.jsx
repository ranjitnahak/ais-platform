import { useRef } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { classifyScore } from '../../lib/scoring';
import { athleteDisplayName, athleteInitialsFromAthlete } from '../../lib/athleteName';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:          '#131315',
  cardHigh:    '#2a2a2c',
  cardLow:     '#1b1b1d',
  cardHighest: '#353437',
  orange:      '#F97316',
  orangeLight: '#FFB690',
  onOrange:    '#552100',
  onSurface:   '#e4e2e4',
  outline:     '#a78b7d',
  green:       '#22C55E',
  blue:        '#3B82F6',
  red:         '#EF4444',
  tertiary:    '#4ae176',
  border:      'rgba(255,255,255,0.06)',
};

const CLASS_STYLE = {
  'Excellent':     { bg: '#22C55E', text: '#ffffff', bar: '#22C55E' },
  'Above Average': { bg: '#3B82F6', text: '#ffffff', bar: '#3B82F6' },
  'Average':       { bg: '#F97316', text: '#ffffff', bar: '#F97316' },
  'Below Average': { bg: '#EF4444', text: '#ffffff', bar: '#EF4444' },
  'Unclassified':  { bg: '#374151', text: '#9ca3af', bar: '#374151' },
};

function getClassStyle(classification) {
  const key = Object.keys(CLASS_STYLE).find(
    (k) => k.toLowerCase() === (classification ?? '').toLowerCase()
  );
  return CLASS_STYLE[key] ?? CLASS_STYLE['Unclassified'];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// Display name overrides — maps DB test_definitions.name values to UI labels.
// DB values are unchanged; only the rendered strings are affected.
const TEST_DISPLAY_NAMES = {
  'Sprint 5m':    'Split 1 (0–5m)',
  'Sprint 10m':   'Split 2 (5–10m)',
  'Sprint 20m':   'Split 3 (10–20m)',
  'Sprint Total': 'Total Time (0–20m)',
};
function displayTestName(name) {
  return TEST_DISPLAY_NAMES[name] ?? name;
}

// Maps a test name to its fitness quality axis.
// Axes: Flexibility, Upper Body Power, Lower Body Power, Speed, Endurance.
function getTestMeta(testName) {
  const n = (testName ?? '').toLowerCase().trim();
  if (n === 'sit and reach' || n.includes('sit') || n.includes('reach') || n.includes('flexibility'))
    return { axis: 'Flexibility', unit: 'cm' };
  if (n === 'seated chest medicine ball throw' || n.includes('chest') || n.includes('throw') || n.includes('med ball'))
    return { axis: 'Upper Body Power', unit: 'm' };
  if (n === 'standing broad jump' || n.includes('broad') || n.includes('jump'))
    return { axis: 'Lower Body Power', unit: 'm' };
  if (n.includes('sprint') || n.includes('split') || n.includes('total') || n.includes('speed'))
    return { axis: 'Speed', unit: 's' };
  if (n.includes('yo') || n.includes('ir1') || n.includes('endurance'))
    return { axis: 'Endurance', unit: 'level' };
  return { axis: null, unit: '' };
}

function computeAge(dob) {
  if (!dob) return null;
  const d = new Date(dob), t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age--;
  return age;
}

function formatDate(ds) {
  if (!ds) return '—';
  return new Date(ds).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).toUpperCase();
}

// Normalise DB tier strings (e.g. "below_average") to proper display labels ("Below Average").
function formatTier(tier) {
  if (!tier) return 'Unclassified';
  const known = { excellent: 'Excellent', above_average: 'Above Average', average: 'Average', below_average: 'Below Average' };
  return known[tier.toLowerCase()] ?? tier
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Percentile-rank → tier label.
function overallFromAvgPct(avg) {
  if (avg == null) return 'Unclassified';
  if (avg >= 75)   return 'Excellent';
  if (avg >= 50)   return 'Above Average';
  if (avg >= 25)   return 'Average';
  return 'Below Average';
}

// Tier → numeric score and back.
const TIER_SCORE = { 'Below Average': 1, 'Average': 2, 'Above Average': 3, 'Excellent': 4 };
function getTierScore(cls) {
  if (!cls) return null;
  const key = Object.keys(TIER_SCORE).find(
    k => k.toLowerCase() === cls.toLowerCase()
  );
  return key ? TIER_SCORE[key] : null;
}
const SCORE_TIER = ['', 'Below Average', 'Average', 'Above Average', 'Excellent'];

// The 5 fitness quality axes — used for axis matching in getTestMeta, overallFromQualities,
// and the radar chart computation. Keep these in sync with getTestMeta's return values.
const QUALITY_AXES = ['Flexibility', 'Upper Body Power', 'Lower Body Power', 'Speed', 'Endurance'];

// Shortened display labels for the radar chart (same order as QUALITY_AXES).
const RADAR_LABELS = ['Flexibility', 'Upper Body Power', 'Lower Body Power', 'Speed', 'Endurance'];

// Map a numeric average tier score to a tier label using explicit thresholds.
function avgScoreToTier(avg) {
  if (avg >= 3.5) return 'Excellent';
  if (avg >= 2.5) return 'Above Average';
  if (avg >= 1.5) return 'Average';
  return 'Below Average';
}

// For each quality axis, average the tier scores of its tests, then average the quality
// scores together and map back to a tier label.
// Falls back to a flat average of all classified tests when fewer than 3 quality groups
// have data (e.g. when axis keyword matching misses some tests).
function overallFromQualities(processedResults) {
  const classified = processedResults.filter((r) => getTierScore(r.classification) != null);
  if (!classified.length) return 'Unclassified';

  const qualityAvgs = QUALITY_AXES.map((axis) => {
    const scores = classified
      .filter((r) => r.axis === axis)
      .map((r) => getTierScore(r.classification));
    if (!scores.length) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }).filter((s) => s != null);

  const avgScore = qualityAvgs.length >= 3
    ? qualityAvgs.reduce((a, b) => a + b, 0) / qualityAvgs.length
    : classified.map((r) => getTierScore(r.classification)).reduce((a, b) => a + b, 0) / classified.length;

  return avgScoreToTier(avgScore);
}

// Tier → radar value: below_average=25, average=50, above_average=75, excellent=100.
function tierToRadarVal(tier) {
  return (getTierScore(tier) ?? 0) * 25;
}

// Correct ordinal suffix: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd, 23rd…
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function AthleteReport({ athlete, session, results = [], benchmarks = [], orgLogoUrl, teamLogoUrl, signatoryName, signatoryTitle }) {
  const reportRef = useRef(null);

  // ── Compute per-test classification + percentile ───────────────────────────
  const processed = results.map((r) => {
    const { axis, unit: defUnit } = getTestMeta((r.test_name ?? '').trim());
    if (!axis) console.warn('getTestMeta: no axis matched for test:', JSON.stringify(r.test_name));
    const testBms = benchmarks.filter(
      (b) => b.test_id === r.test_id && b.gender === athlete?.gender,
    );
    const { classification, percentileRank } = classifyScore({
      value: r.value,
      gender: athlete?.gender,
      direction: r.direction ?? 'higher_is_better',
      benchmarks: testBms,
      squadValues: r.squadValues ?? [],
    });
    // Normalise tier strings from the DB before any downstream use.
    let finalClassification = formatTier(classification);
    // If classification is still Unclassified but we have a valid percentile rank,
    // re-derive the tier from the percentile so female athletes always get a meaningful result.
    if (finalClassification === 'Unclassified' && percentileRank != null) {
      if (percentileRank >= 75)      finalClassification = 'Excellent';
      else if (percentileRank >= 50) finalClassification = 'Above Average';
      else if (percentileRank >= 25) finalClassification = 'Average';
      else                           finalClassification = 'Below Average';
    }
    return { ...r, axis, unit: r.unit ?? defUnit, classification: finalClassification, percentileRank };
  });

  // ── Overall — derived from 5 quality axes, each averaged from their tests ──
  const rankedAll    = processed.filter((r) => r.percentileRank != null);
  const sortedPcts = rankedAll.map((r) => r.percentileRank).sort((a, b) => a - b);
  const medianPct  = sortedPcts.length
    ? sortedPcts.length % 2 === 0
      ? (sortedPcts[sortedPcts.length / 2 - 1] + sortedPcts[sortedPcts.length / 2]) / 2
      : sortedPcts[Math.floor(sortedPcts.length / 2)]
    : null;
  const overall      = overallFromAvgPct(medianPct);
  const overallStyle = getClassStyle(overall);

  // ── Quality-axis tier bucketing for Performance Summary ───────────────────
  // Compute the average tier for each of the 5 quality axes, then bucket into
  // Strengths (Excellent/Above Average), Developing (Average), Priority (Below Average).
  const qualityTierMap = Object.fromEntries(
    QUALITY_AXES.map((axis) => {
      const scores = processed
        .filter((r) => r.axis === axis)
        .map((r) => getTierScore(r.classification))
        .filter((s) => s != null);
      if (!scores.length) return [axis, null];
      return [axis, avgScoreToTier(scores.reduce((a, b) => a + b, 0) / scores.length)];
    }).filter(([, t]) => t != null),
  );

  const strengthQualities  = QUALITY_AXES.filter((q) => qualityTierMap[q] === 'Excellent' || qualityTierMap[q] === 'Above Average');
  const developingQualities = QUALITY_AXES.filter((q) => qualityTierMap[q] === 'Average');
  const priorityQualities  = QUALITY_AXES.filter((q) => qualityTierMap[q] === 'Below Average');

  function formatQualityList(qs) {
    if (qs.length === 1) return qs[0];
    if (qs.length === 2) return `${qs[0]} and ${qs[1]}`;
    return `${qs.slice(0, -1).join(', ')}, and ${qs[qs.length - 1]}`;
  }

  // ── Radar data — percentile rank of the representative test for each axis ──
  // One canonical test per axis: Sit & Reach, Chest Pass, Broad Jump, Sprint Total, Yo-Yo.
  // percentileRank is already direction-aware (lower_is_better is inverted inside classifyScore).
  // Falls back to tier-based value (25 / 50 / 75 / 100) when percentileRank is unavailable.
  const AXIS_REP_TEST = {
    'Flexibility':      (n) => n.toLowerCase().includes('sit') || n.toLowerCase().includes('reach'),
    'Upper Body Power': (n) => n.toLowerCase().includes('chest') || n.toLowerCase().includes('pass'),
    'Lower Body Power': (n) => n.toLowerCase().includes('broad') || n.toLowerCase().includes('jump'),
    'Speed':            (n) => n.toLowerCase().includes('total'),
    'Endurance':        (n) => n.toLowerCase().includes('yo'),
  };

  const radarVals = QUALITY_AXES.map((axis) => {
    const rep = processed.find((r) => r.axis === axis && AXIS_REP_TEST[axis]?.(r.test_name));
    if (rep?.percentileRank != null) return Math.round(rep.percentileRank);
    // Fallback: average tier score × 25
    const tests  = processed.filter((r) => r.axis === axis);
    if (!tests.length) return 0;
    const scores = tests.map((r) => getTierScore(r.classification)).filter(Boolean);
    if (!scores.length) return 0;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 25);
  });

  const radarData = {
    labels: RADAR_LABELS,
    datasets: [{
      data: radarVals,
      borderColor: '#F97316',
      backgroundColor: 'rgba(249,115,22,0.15)',
      borderWidth: 2,
      pointBackgroundColor: '#F97316',
      pointBorderColor: '#F97316',
      pointRadius: 4,
    }],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { display: false, stepSize: 25 },
        grid: { color: 'rgba(255,255,255,0.08)' },
        angleLines: { color: 'rgba(255,255,255,0.08)' },
        pointLabels: {
          display: true,
          color: '#a78b7d',
          font: { size: 12, weight: 'bold', family: 'Inter, system-ui, sans-serif' },
        },
      },
    },
    layout: {
      padding: { left: 60, right: 60, top: 30, bottom: 30 },
    },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} / 100` } },
    },
  };

  const age = computeAge(athlete?.date_of_birth);

  // ── PDF Download ───────────────────────────────────────────────────────────
  async function handleDownload() {
    if (!reportRef.current) return;
    try {
      const el      = reportRef.current;
      const actions = document.getElementById('report-actions');
      if (actions) actions.style.display = 'none';
      // Use scrollHeight so html2canvas captures only content height, not viewport.
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: C.bg,
        useCORS: true,
        allowTaint: true,
        logging: false,
        height: el.scrollHeight,
        windowHeight: el.scrollHeight,
      });

      // Create PDF with page height exactly matching content — no trailing whitespace.
      const pdfW    = 210; // A4 width in mm
      const pdfH    = (canvas.height / canvas.width) * pdfW;
      const imgData = canvas.toDataURL('image/png');

      if (pdfH <= 297) {
        // Fits on a single page — set page height to content height exactly.
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfW, pdfH] });
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
        const safeName = (athleteDisplayName(athlete) || 'athlete').replace(/\s+/g, '_');
        const safeDate = session?.assessed_on?.slice(0, 10) ?? 'unknown';
        pdf.save(`${safeName}_assessment_${safeDate}.pdf`);
      } else {
        // Multi-page: use standard A4 and tile the image.
        const pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageH = pdf.internal.pageSize.getHeight();
        let offset  = 0;
        while (offset < pdfH) {
          if (offset > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, -offset, pdfW, pdfH);
          offset += pageH;
        }
        const safeName = (athleteDisplayName(athlete) || 'athlete').replace(/\s+/g, '_');
        const safeDate = session?.assessed_on?.slice(0, 10) ?? 'unknown';
        pdf.save(`${safeName}_assessment_${safeDate}.pdf`);
      }

      if (actions) actions.style.display = '';
    } catch (err) {
      if (document.getElementById('report-actions')) {
        document.getElementById('report-actions').style.display = '';
      }
      console.error('PDF generation failed:', err);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Printable Report (inline styles throughout for html2canvas) ─────── */}
      <div
        ref={reportRef}
        style={{
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          backgroundColor: C.bg,
          color: C.onSurface,
          padding: '40px',
          maxWidth: '960px',
          boxSizing: 'border-box',
        }}
      >
        {/* ── Header: org logo | athlete info | session info ────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '24px' }}>

          {/* Left — Primary org logo */}
          <div style={{ flexShrink: 0, width: '72px' }}>
            {orgLogoUrl && (
              <img
                src={orgLogoUrl}
                alt="Organisation"
                crossOrigin="anonymous"
                style={{ maxHeight: '60px', maxWidth: '72px', objectFit: 'contain' }}
              />
            )}
          </div>

          {/* Centre — Athlete info */}
          <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            {athlete?.photo_url ? (
              <img
                src={athlete.photo_url}
                alt={athleteDisplayName(athlete)}
                crossOrigin="anonymous"
                style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${C.orange}` }}
              />
            ) : (
              <div style={{
                width: '120px', height: '120px', borderRadius: '50%',
                backgroundColor: C.cardHighest,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '40px', fontWeight: 900, color: C.onSurface,
                border: `2px solid ${C.border}`,
              }}>
                {athleteInitialsFromAthlete(athlete)}
              </div>
            )}
            <div>
              <div style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.04em', color: '#ffffff', margin: 0, textTransform: 'uppercase', lineHeight: 1 }}>
                {athleteDisplayName(athlete)}
              </div>
              <div style={{ fontSize: '10px', color: C.outline, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '6px' }}>
                {[athlete?.gender, age ? `Age ${age}` : null, athlete?.position, athlete?.organisations?.sport]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>

          {/* Right — Secondary org logo + session info */}
          <div style={{ flexShrink: 0, textAlign: 'right', borderLeft: `2px solid ${C.orange}`, paddingLeft: '16px', minWidth: '160px' }}>
            {athlete?.organisations?.secondary_logo_url && (
              <img
                src={athlete.organisations.secondary_logo_url}
                alt="Secondary logo"
                crossOrigin="anonymous"
                style={{ maxHeight: '50px', maxWidth: '140px', objectFit: 'contain', display: 'block', marginLeft: 'auto', marginBottom: '10px' }}
              />
            )}
            {teamLogoUrl && (
              <img
                src={teamLogoUrl}
                alt="Team"
                crossOrigin="anonymous"
                style={{
                  maxHeight: '36px',
                  maxWidth: '120px',
                  objectFit: 'contain',
                  display: 'block',
                  marginLeft: 'auto',
                  marginBottom: '8px',
                  opacity: 0.85,
                }}
              />
            )}
            <div style={{ fontSize: '9px', fontWeight: 700, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              Camp / Assessment
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace, monospace', lineHeight: 1.4 }}>
              {session?.name ?? 'Assessment'}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.outline, fontFamily: 'monospace, monospace', marginTop: '4px' }}>
              {formatDate(session?.assessed_on)}
            </div>
          </div>
        </div>

        {/* ── Title bar + overall badge ───────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: '24px',
          borderBottom: `1px solid ${C.border}`, paddingBottom: '20px',
          gap: '16px',
        }}>
          <div>
            <div style={{
              fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em',
              color: '#ffffff', textTransform: 'uppercase', lineHeight: 1, margin: 0,
            }}>
              Performance Assessment Report
            </div>
          </div>

          {/* Overall Classification Badge */}
          <div style={{
            padding: '14px 20px',
            backgroundColor: overallStyle.bg,
            border: `1px solid ${overallStyle.text}`,
            borderRadius: '8px',
            textAlign: 'center',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: '8px', fontWeight: 700, color: overallStyle.text, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              Overall Classification
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: overallStyle.text, textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {overall}
            </div>
            {(medianPct != null && medianPct > 0) && (
              <div style={{ fontSize: '10px', color: overallStyle.text, marginTop: '4px', fontWeight: 700 }}>
                {ordinal(Math.round(medianPct))} percentile
              </div>
            )}
          </div>
        </div>

        {/* ── Test Score Cards ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(processed.length || 1, 5)}, 1fr)`,
          gap: '12px',
          marginBottom: '24px',
        }}>
          {processed.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', backgroundColor: C.cardHigh, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '32px', textAlign: 'center', color: C.outline, fontSize: '13px' }}>
              No test results available for this assessment.
            </div>
          ) : (
            processed.map((r) => {
              const cs = getClassStyle(r.classification);
              function getBarWidth(cls) {
                if (!cls) return '4%';
                const c = cls.toLowerCase();
                if (c === 'excellent') return '100%';
                if (c === 'above average') return '75%';
                if (c === 'average') return '50%';
                if (c === 'below average') return '25%';
                return '4%';
              }
              const barWidth = getBarWidth(r.classification);
              return (
                <div
                  key={r.test_id}
                  style={{
                    backgroundColor: C.cardHigh,
                    border: `1px solid ${C.border}`,
                    borderRadius: '8px',
                    padding: '18px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >

                  <div style={{ fontSize: '8px', fontWeight: 700, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {displayTestName(r.test_name)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '30px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.04em', lineHeight: 1 }}>
                      {r.value ?? '—'}
                    </span>
                    {r.unit && (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: C.outline }}>
                        {r.unit}
                      </span>
                    )}
                  </div>

                  {/* Classification badge */}
                  <span style={{
                    backgroundColor: cs.bg,
                    color: cs.text,
                    padding: '2px 8px',
                    borderRadius: '100px',
                    fontSize: '7px',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    alignSelf: 'flex-start',
                  }}>
                    {r.classification}
                  </span>

                  {/* Percentile bar */}
                  <div>
                    <div style={{ height: '4px', backgroundColor: C.cardHighest, borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: barWidth, backgroundColor: cs.bar }} />
                    </div>
                    <div style={{ fontSize: '8px', color: C.outline, fontWeight: 700, textAlign: 'right', marginTop: '3px' }}>
                      {(r.percentileRank != null && r.percentileRank > 0) ? ordinal(Math.round(r.percentileRank)) : '—'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Insights + Radar ─────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>

          {/* Strengths / Weaknesses */}
          <div style={{
            backgroundColor: C.cardLow,
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            padding: '28px',
          }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '6px',
                backgroundColor: 'rgba(249,115,22,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" fill="#F97316"/>
                </svg>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Performance Summary
              </div>
            </div>

            {/* Strengths — Excellent or Above Average */}
            {strengthQualities.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: C.tertiary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                  Strengths
                </div>
                <div style={{ fontSize: '13px', color: C.onSurface, lineHeight: 1.6 }}>
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>{formatQualityList(strengthQualities)}</span>
                  {strengthQualities.length === 1
                    ? ' is a clear strength. Performance is above the squad standard in this area.'
                    : ' are clear strengths. Performance is above the squad standard in these areas.'}
                </div>
              </div>
            )}

            {/* Developing — Average */}
            {developingQualities.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                  Developing
                </div>
                <div style={{ fontSize: '13px', color: C.onSurface, lineHeight: 1.6 }}>
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>{formatQualityList(developingQualities)}</span>
                  {developingQualities.length === 1
                    ? ' is at squad average. Targeted work in this area will have the most impact on overall performance.'
                    : ' are at squad average. Targeted work in these areas will have the most impact on overall performance.'}
                </div>
              </div>
            )}

            {/* Priority Focus — Below Average */}
            {priorityQualities.length > 0 && (
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                  Priority Focus
                </div>
                <div style={{ fontSize: '13px', color: C.onSurface, lineHeight: 1.6 }}>
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>{formatQualityList(priorityQualities)}</span>
                  {priorityQualities.length === 1
                    ? ' is currently below the squad standard and should be a primary focus in the upcoming training block.'
                    : ' are currently below the squad standard and should be a primary focus in the upcoming training block.'}
                </div>
              </div>
            )}

            {/* No data fallback */}
            {strengthQualities.length === 0 && developingQualities.length === 0 && priorityQualities.length === 0 && (
              <div style={{ fontSize: '12px', color: C.outline }}>
                Insufficient data for performance summary.
              </div>
            )}
          </div>

          {/* Radar Chart */}
          <div style={{
            backgroundColor: C.cardHigh,
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>
              Performance Profile
            </div>
            <div style={{ width: '100%', height: '280px', overflow: 'visible' }}>
              <Radar data={radarData} options={radarOptions} />
            </div>
            <div style={{ textAlign: 'center', marginTop: '4px' }}>
              {(medianPct != null && medianPct > 0) && (
                <div style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {ordinal(Math.round(medianPct))}<span style={{ fontSize: '12px', color: C.outline }}> percentile</span>
                </div>
              )}
              <div style={{ fontSize: '9px', fontWeight: 700, color: overallStyle.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>
                {overall}
              </div>
            </div>
          </div>
        </div>

        {/* ── Signatory ────────────────────────────────────────────────────────── */}
        {(signatoryName || signatoryTitle) && (
          <div style={{
            borderTop: `2px solid ${C.orange}`,
            marginTop: '8px',
            paddingTop: '14px',
            paddingBottom: '14px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}>
            <div style={{ textAlign: 'right', fontFamily: "'Inter', system-ui, sans-serif" }}>
              {signatoryName && (
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>
                  {signatoryName}
                </div>
              )}
              {signatoryTitle && (
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginTop: '3px' }}>
                  {signatoryTitle}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '20px',
          borderTop: `1px solid ${C.border}`,
          gap: '16px',
        }}>

          <div id="report-actions" style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
            {/* Forward button */}
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 18px',
                backgroundColor: C.cardHighest,
                color: C.onSurface,
                border: `1px solid rgba(255,255,255,0.08)`,
                borderRadius: '8px',
                fontSize: '8px', fontWeight: 900,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                cursor: 'pointer',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 6.5l-4-4v3H7c-2.21 0-4 1.79-4 4v4h2v-4c0-1.1.9-2 2-2h10v3l4-4z"/>
              </svg>
              Forward
            </button>

            {/* Download PDF button */}
            <button
              onClick={handleDownload}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 24px',
                background: `linear-gradient(135deg, ${C.orangeLight}, ${C.orange})`,
                color: C.onOrange,
                border: 'none',
                borderRadius: '8px',
                fontSize: '8px', fontWeight: 900,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                cursor: 'pointer',
                fontFamily: "'Inter', system-ui, sans-serif",
                boxShadow: '0 4px 20px rgba(249,115,22,0.3)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              Download PDF
            </button>

            {/* Send Report button */}
            <button
              onClick={() => {
                console.log('athlete object:', JSON.stringify(athlete));
                const subject = encodeURIComponent(`Performance Assessment Report — S&C Camp 28 Mar 2026`);
                const body    = encodeURIComponent(`Hi ${athleteDisplayName(athlete) || ''},\n\nPlease find your performance assessment report attached.\n\nRegards,\nRanjit Nahak\nStrength and Conditioning Coach`);
                window.location.href = `mailto:${athlete?.email ?? ''}?subject=${subject}&body=${body}`;
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 18px',
                backgroundColor: C.cardHighest,
                color: C.onSurface,
                border: `1px solid ${C.orange}`,
                borderRadius: '8px',
                fontSize: '8px', fontWeight: 900,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                cursor: 'pointer',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              Send Report
            </button>
          </div>
        </div>

      </div>
      {/* ── End printable area ─────────────────────────────────────────────────── */}
    </div>
  );
}
