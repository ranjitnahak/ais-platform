const PRINT_STYLE_ID = 'staff-logs-print-style';

export async function printStaffLogsReport(reportEl) {
  if (!reportEl) return;
  try {
    const existing = document.getElementById(PRINT_STYLE_ID);
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    style.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        #staff-logs-report-content, #staff-logs-report-content * { visibility: visible !important; }
        #staff-logs-report-content {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          background: white !important;
          color: #111 !important;
        }
        #staff-logs-report-content * {
          color: #111 !important;
          border-color: #ddd !important;
        }
        .no-print { display: none !important; }
        @page { margin: 15mm; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const el = document.getElementById(PRINT_STYLE_ID);
      if (el) el.remove();
    }, 1000);
  } catch (err) {
    console.error('[staffLogsExport] printStaffLogsReport failed:', err);
    throw err;
  }
}
