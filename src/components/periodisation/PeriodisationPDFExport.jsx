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
    const res = await fetch(url, {
      mode: 'cors',
      cache: 'no-cache',
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Crop a base64 image into a circle and return a PNG base64. Falls back to original on error. */
async function cropToCircle(base64) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        const offsetX = (img.width - size) / 2;
        const offsetY = (img.height - size) / 2;
        ctx.drawImage(img, -offsetX, -offsetY);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    } catch {
      resolve(base64);
    }
  });
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
    teamLogoUrl,
    loadWaveData,
    athleteName,
    athletePhotoUrl,
    athletePosition,
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
      // Load logos and athlete photo concurrently
      const [teamLogoBase64Raw, rawAthletePhotoBase64] = await Promise.all([
        teamLogoUrl ? urlToBase64(teamLogoUrl) : Promise.resolve(null),
        athletePhotoUrl ? urlToBase64(athletePhotoUrl) : Promise.resolve(null),
      ]);

      let athletePhotoBase64 = rawAthletePhotoBase64;
      if (athletePhotoBase64) {
        athletePhotoBase64 = await cropToCircle(athletePhotoBase64);
      }

      console.log('PDFExport:', {
        hasTeamLogo: !!teamLogoBase64Raw,
        hasAthletePhoto: !!athletePhotoBase64,
      });

      // Detect natural dimensions for contain-fit sizing in the header
      const teamLogoDims = teamLogoBase64Raw
        ? await getBase64Dims(teamLogoBase64Raw)
        : null;

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
        teamLogoBase64: teamLogoBase64Raw,
        teamLogoDims,
        loadWaveImgBase64,
        loadWaveData,
        athleteName,
        athletePhotoBase64,
        athletePosition,
      });

      const safeTeam = (teamName ?? 'Team').replace(/\s+/g, '');
      const safeAthlete = athleteName ? athleteName.replace(/\s+/g, '') : null;
      const startLabel = fileDateLabel(plan?.start_date);
      const endLabel = fileDateLabel(plan?.end_date);
      const filename = safeAthlete
        ? `${safeTeam}_${safeAthlete}_Periodisation_${startLabel}_${endLabel}.pdf`
        : `${safeTeam}_Periodisation_${startLabel}_${endLabel}.pdf`;
      pdf.save(filename);

      onExportComplete?.();
    } catch (err) {
      console.error('PDFExport: ', err);
      onExportError?.(err);
    }
  }

  return null;
});

export default PeriodisationPDFExport;
