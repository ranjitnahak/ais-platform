import { useState } from 'react';
import { buildDashboardPDF } from '../../lib/buildDashboardPDF';
import ExportPdfButton from './ExportPdfButton';

export default function DashboardExportButton({
  exportRef,
  filename,
  disabled = false,
  label = 'Export PDF',
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  async function handleExport() {
    if (!exportRef?.current || exporting || disabled) return;
    setExporting(true);
    setError(null);
    try {
      await buildDashboardPDF({ contentEl: exportRef.current, filename });
    } catch (err) {
      setError(err?.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div data-pdf-exclude>
      <ExportPdfButton
        onClick={handleExport}
        disabled={disabled}
        exporting={exporting}
        error={error}
        label={label}
      />
    </div>
  );
}
