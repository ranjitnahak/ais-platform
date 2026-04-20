/**
 * PeriodisationPDFExport
 * Orchestrates multi-page A4 landscape PDF export of the periodisation plan.
 * Renders each page chunk into a hidden off-screen div, captures with html2canvas,
 * assembles in jsPDF, then triggers download.
 *
 * Usage: attach a ref and call ref.current.exportToPDF()
 */
import { forwardRef, useImperativeHandle } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getCurrentUser } from '../../lib/auth';
import PeriodisationPDFPage from './PeriodisationPDFPage';

const WEEKS_PER_PAGE = 17;
const PAGE_WIDTH_MM = 297;   // A4 landscape
const PAGE_HEIGHT_MM = 210;

/** Format a plan date as "MmmYYYY" for the filename */
function fileDateLabel(iso) {
  if (!iso) return 'Unknown';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).replace(/\s/, '');
}

/** Format a plan date range as human-readable string */
function formatDateRange(startIso, endIso) {
  if (!startIso) return '';
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  const a = new Date(startIso + 'T12:00:00').toLocaleDateString('en-GB', opts);
  const b = endIso ? new Date(endIso + 'T12:00:00').toLocaleDateString('en-GB', opts) : '';
  return b ? `${a} — ${b}` : a;
}

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

  // eslint-disable-next-line no-unused-vars
  const _user = getCurrentUser(); // ensures org context is always read from auth

  async function exportToPDF() {
    onExportStart?.();

    // Visible rows only
    const visibleRows = rows.filter((r) => r.is_visible !== false);

    // Split weeks into page-sized chunks
    const chunks = [];
    for (let i = 0; i < weeks.length; i += WEEKS_PER_PAGE) {
      chunks.push(weeks.slice(i, i + WEEKS_PER_PAGE));
    }

    if (!chunks.length) {
      onExportComplete?.();
      return;
    }

    const planName = plan?.name ?? 'Periodisation Plan';
    const dateRange = formatDateRange(plan?.start_date, plan?.end_date);
    const totalPages = chunks.length;

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    try {
      for (let pi = 0; pi < chunks.length; pi++) {
        const chunk = chunks[pi];
        const isLast = pi === chunks.length - 1;

        // Build loadWaveData slice for this page's weeks
        const pageStart = pi * WEEKS_PER_PAGE;
        const pageLoadWave = loadWaveData
          ? {
              labels: loadWaveData.labels?.slice(pageStart, pageStart + chunk.length) ?? [],
              volume: loadWaveData.volume?.slice(pageStart, pageStart + chunk.length) ?? [],
              intensity: loadWaveData.intensity?.slice(pageStart, pageStart + chunk.length) ?? [],
              acwr: loadWaveData.acwr?.slice(pageStart, pageStart + chunk.length) ?? [],
            }
          : null;

        // Create a temporary off-screen container
        const container = document.createElement('div');
        container.style.cssText =
          'position:fixed;left:-9999px;top:0;visibility:hidden;z-index:-1;';
        document.body.appendChild(container);

        const root = createRoot(container);

        // Render the page into the container and wait for paint
        await new Promise((resolve) => {
          root.render(
            <PeriodisationPDFPage
              weeks={chunk}
              rows={visibleRows}
              cells={cells}
              planName={planName}
              teamName={teamName ?? ''}
              dateRange={dateRange}
              pageNumber={pi + 1}
              totalPages={totalPages}
              orgLogoUrl={orgLogoUrl}
              secondaryLogoUrl={secondaryLogoUrl}
              showLoadWave={isLast}
              loadWaveData={pageLoadWave}
              isLastPage={isLast}
            />,
          );
          // Poll until the container has actual content in the DOM
          const poll = setInterval(() => {
            const el = container.firstElementChild;
            if (el && el.offsetHeight > 0) {
              clearInterval(poll);
              // Extra wait for Chart.js on the last page
              setTimeout(resolve, isLast ? 600 : 0);
            }
          }, 20);
          // Safety timeout — bail after 5 seconds
          setTimeout(() => { clearInterval(poll); resolve(); }, 5000);
        });

        let canvas;
        try {
          const el = container.firstElementChild;
          canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
          });
        } catch (err) {
          console.error('PDFExport: html2canvas failed on page', pi + 1, err);
          throw err;
        }

        if (pi > 0) pdf.addPage();
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, PAGE_WIDTH_MM, PAGE_HEIGHT_MM);

        // Clean up the temporary container
        root.unmount();
        document.body.removeChild(container);
      }

      // Build filename: "{TeamName}_Periodisation_{StartDate}_{EndDate}.pdf"
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

  // This component renders nothing visible
  return null;
});

export default PeriodisationPDFExport;
