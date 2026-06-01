import { DEXA_UI_SECTIONS } from '../../lib/dexaFieldConfig';
import DexaFieldInput from './DexaFieldInput';
import DexaRegionalTable from './DexaRegionalTable';

export default function DexaFieldsPanel({
  step,
  extractedFields,
  populatedFields,
  highlightedKeys,
  athleteName,
  onChange,
  onSave,
  onCancel,
  onReset,
  saving,
}) {
  const showPanel = ['extracting', 'reviewing', 'saving', 'saved'].includes(step);
  if (!showPanel) return null;

  return (
    <div className="space-y-6 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
      {DEXA_UI_SECTIONS.slice(0, 2).map((section) => (
        <section key={section.title} className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
            {section.title}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.fields.map((field) => (
              <DexaFieldInput
                key={field.fieldKey}
                label={field.label}
                fieldKey={field.fieldKey}
                value={extractedFields?.[field.fieldKey]}
                type={field.type}
                isPopulated={populatedFields.has(field.fieldKey)}
                isHighlighted={highlightedKeys.has(field.fieldKey)}
                onChange={onChange}
              />
            ))}
          </div>
        </section>
      ))}

      <DexaRegionalTable
        extractedFields={extractedFields}
        populatedFields={populatedFields}
        highlightedKeys={highlightedKeys}
        step={step}
        onChange={onChange}
      />

      {DEXA_UI_SECTIONS.slice(2).map((section) => (
        <section key={section.title} className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
            {section.title}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.fields.map((field) => (
              <DexaFieldInput
                key={field.fieldKey}
                label={field.label}
                fieldKey={field.fieldKey}
                value={extractedFields?.[field.fieldKey]}
                type={field.type}
                isPopulated={populatedFields.has(field.fieldKey)}
                isHighlighted={highlightedKeys.has(field.fieldKey)}
                onChange={onChange}
              />
            ))}
          </div>
        </section>
      ))}

      {step === 'reviewing' && (
        <div className="space-y-3 border-t border-[var(--color-outline-variant)] pt-5">
          <span className="inline-block rounded-full bg-[var(--color-surface-container-high)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Source: AI Extracted
          </span>
          <button
            type="button"
            onClick={onSave}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--color-primary-container)] text-sm font-black uppercase tracking-widest text-[var(--color-on-primary)]"
          >
            Confirm &amp; Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 w-full rounded-xl border border-[var(--color-outline-variant)] bg-transparent text-sm font-bold text-[var(--color-on-surface-variant)]"
          >
            Cancel
          </button>
        </div>
      )}

      {step === 'saving' && (
        <div className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-surface-container-high)]">
          <div className="app-loading-progress" aria-hidden />
          <span className="text-sm font-bold text-[var(--color-on-surface)]">Saving…</span>
        </div>
      )}

      {step === 'saved' && (
        <div className="space-y-3 border-t border-[var(--color-outline-variant)] pt-5">
          <p className="text-sm font-bold text-[var(--color-tertiary)]">
            Scan saved for {athleteName || 'athlete'}
          </p>
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] text-sm font-black uppercase tracking-widest text-[var(--color-on-surface)]"
          >
            Upload Another Scan
          </button>
        </div>
      )}
    </div>
  );
}
