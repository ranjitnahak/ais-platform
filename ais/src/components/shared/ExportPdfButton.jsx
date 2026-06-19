export default function ExportPdfButton({
  onClick,
  disabled = false,
  exporting = false,
  error = null,
  label = 'Export PDF',
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || exporting}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 text-xs font-bold text-[var(--color-on-surface)] transition-opacity disabled:opacity-50"
      >
        {exporting ? (
          <>
            <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
            Exporting…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-base">download</span>
            {label}
          </>
        )}
      </button>
      {error && (
        <p className="max-w-[12rem] text-right text-[10px] text-[var(--color-error)]">{error}</p>
      )}
    </div>
  );
}
