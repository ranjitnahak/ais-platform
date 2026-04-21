/**
 * PeriodisationPDFExport
 * Orchestrates jsPDF-native periodisation plan export.
 *
 * Responsibilities:
 *   1. Logo loading — convert URLs to base64 and detect natural dimensions
 *   2. Load-wave chart capture — Chart.js rendered onto a raw off-screen canvas
 *      (the ONLY place html2canvas / DOM manipulation occurs in this flow)
 *   3. PDF assembly — delegates all drawing to buildPeriodisationPDF()
 *   4. File save
 *
 * Usage: attach a ref and call ref.current.exportToPDF()
 */
import { forwardRef, useImperativeHandle } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import jsPDF from 'jspdf';
import { getCurrentUser } from '../../lib/auth';
import { buildPeriodisationPDF } from '../../lib/buildPeriodisationPDF';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// ── Logo helpers ──────────────────────────────────────────────────────────────

/** Convert a remote URL to a base64 data URL. Returns null on any error. */
async function urlToBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Return the natural pixel dimensions of a base64 image. Returns null on error. */
async function getBase64Dims(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = base64;
  });
}

// ── Chart capture ─────────────────────────────────────────────────────────────

/**
 * Render the load-wave line chart onto a hidden canvas and return a PNG base64.
 * Chart.js is used directly (no React). Returns null if loadWaveData is absent.
 */
async function captureLoadWaveChart(loadWaveData) {
  if (!loadWaveData) return null;

  const chartCanvas = document.createElement('canvas');
  chartCanvas.width = 1200;
  chartCanvas.height = 200;
  chartCanvas.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none;';
  document.body.appendChild(chartCanvas);

  const n = (loadWaveData.volume ?? loadWaveData.intensity ?? []).length;
  const labels = Array.from({ length: n }, (_, i) => `W${i + 1}`);

  const chart = new ChartJS(chartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Volume',
          data: (loadWaveData.volume ?? []).map((v) => v ?? null),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          fill: true,
          tension: 0.25,
          pointRadius: 2,
        },
        {
          label: 'Intensity',
          data: (loadWaveData.intensity ?? []).map((v) => v ?? null),
          borderColor: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.06)',
          fill: true,
          tension: 0.25,
          pointRadius: 2,
        },
        {
          label: 'ACWR',
          data: (loadWaveData.acwr ?? []).map((v) => (v == null ? null : Math.min(10, v * 4))),
          borderColor: '#22c55e',
          borderDash: [5, 4],
          fill: false,
          tension: 0.25,
          pointRadius: 2,
        },
      ],
    },
    options: {
      animation: false,
      spanGaps: true,
      responsive: false,
      plugins: {
        legend: { position: 'top', labels: { color: '#374151', font: { size: 9 } } },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          ticks: { color: '#6b7280', maxRotation: 0, font: { size: 8 } },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
        y: {
          min: 0,
          max: 10,
          ticks: { color: '#6b7280', font: { size: 8 } },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
      },
    },
  });

  await new Promise((r) => setTimeout(r, 800));
  const imgBase64 = chartCanvas.toDataURL('image/png');
  chart.destroy();
  document.body.removeChild(chartCanvas);
  return imgBase64;
}

// ── Filename helpers ──────────────────────────────────────────────────────────

function fileDateLabel(iso) {
  if (!iso) return 'Unknown';
  return new Date(iso + 'T12:00:00')
    .toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    .replace(/\s/, '');
}

// ── Component ─────────────────────────────────────────────────────────────────

const PeriodisationPDFExport = forwardRef(function PeriodisationPDFExport(
  {
    plan,
    rows,
    cells,
    weeks,
    teamName,
    orgLogoUrl,
    secondaryLogoUrl,
    loadWaveData,
    onExportStart,
    onExportComplete,
    onExportError,
  },
  ref,
) {
  useImperativeHandle(ref, () => ({ exportToPDF }));

  getCurrentUser(); // ensures org context is always read from auth

  async function exportToPDF() {
    onExportStart?.();
    try {
      // Load logos concurrently
      const [orgLogoBase64, secondaryLogoBase64] = await Promise.all([
        orgLogoUrl ? urlToBase64(orgLogoUrl) : Promise.resolve(null),
        secondaryLogoUrl ? urlToBase64(secondaryLogoUrl) : Promise.resolve(null),
      ]);

      // Detect natural dimensions for contain-fit sizing in the header
      const [orgLogoDims, secondaryLogoDims] = await Promise.all([
        orgLogoBase64 ? getBase64Dims(orgLogoBase64) : Promise.resolve(null),
        secondaryLogoBase64 ? getBase64Dims(secondaryLogoBase64) : Promise.resolve(null),
      ]);

      // Capture load-wave chart from the full plan-level data
      let loadWaveImgBase64 = null;
      try {
        loadWaveImgBase64 = await captureLoadWaveChart(loadWaveData);
      } catch (err) {
        console.error('PDFExport: chart capture failed', err);
      }

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      await buildPeriodisationPDF({
        pdf,
        plan,
        rows,
        cells,
        weeks,
        teamName,
        orgLogoBase64,
        orgLogoDims,
        secondaryLogoBase64,
        secondaryLogoDims,
        loadWaveImgBase64,
        loadWaveData,
      });

      const safeTeam = (teamName ?? 'Team').replace(/\s+/g, '');
      const startLabel = fileDateLabel(plan?.start_date);
      const endLabel = fileDateLabel(plan?.end_date);
      pdf.save(`${safeTeam}_Periodisation_${startLabel}_${endLabel}.pdf`);

      onExportComplete?.();
    } catch (err) {
      console.error('PDFExport: ', err);
      onExportError?.(err);
    }
  }

  return null;
});

export default PeriodisationPDFExport;
