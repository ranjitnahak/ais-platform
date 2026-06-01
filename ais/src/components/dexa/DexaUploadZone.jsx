import { useRef } from 'react';

export default function DexaUploadZone({ pdfFile, step, disabled, onFileSelect }) {
  const inputRef = useRef(null);
  const extracting = step === 'extracting' || step === 'uploading';

  function handleFiles(fileList) {
    const file = fileList?.[0];
    if (file) onFileSelect(file);
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={`flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          disabled
            ? 'cursor-not-allowed border-[var(--color-outline-variant)] opacity-50'
            : 'cursor-pointer border-[var(--color-outline)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-container-high)]'
        }`}
      >
        <span className="material-symbols-outlined text-4xl text-[var(--color-outline)]">upload_file</span>
        <p className="text-sm font-bold text-[var(--color-on-surface)]">
          Drop DEXA PDF here or click to browse
        </p>
        <p className="text-xs text-[var(--color-on-surface-variant)]">PDF only</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={disabled}
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {pdfFile && (
        <p className="truncate text-xs font-bold text-[var(--color-on-surface-variant)]">
          {pdfFile.name}
        </p>
      )}

      {extracting && (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-[var(--color-surface-container)] p-4">
          <div className="app-loading-progress" aria-hidden />
          <p className="animate-pulse text-sm font-bold text-[var(--color-primary)]">
            Reading scan report…
          </p>
        </div>
      )}
    </div>
  );
}
