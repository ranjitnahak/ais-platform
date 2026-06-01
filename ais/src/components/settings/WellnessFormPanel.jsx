import { useState } from 'react';
import { parseLabelTranslations } from '../../lib/wellnessFormConstants';
import { useWellnessFormAdmin } from '../../hooks/useWellnessFormAdmin';

function AddQuestionModal({ open, onClose, onSave, saving, inputTypes, emptyForm }) {
  const [form, setForm] = useState({ ...emptyForm });

  if (!open) return null;

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'label' && !current.key) {
        next.key = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 48);
      }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#2a2a2c] p-6 shadow-2xl">
        <h3 className="text-base font-bold text-white">Add wellness question</h3>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
            Label
            <input
              value={form.label}
              onChange={(e) => updateField('label', e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#131315] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
            Key
            <input
              value={form.key}
              onChange={(e) => updateField('key', e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#131315] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
            Hindi label
            <input
              value={form.label_hi}
              onChange={(e) => updateField('label_hi', e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#131315] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
            Input type
            <select
              value={form.input_type}
              onChange={(e) => updateField('input_type', e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#131315] px-3 py-2 text-sm text-white"
            >
              {inputTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          {(form.input_type === 'slider' || form.input_type === 'number') && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
                  Scale min
                  <input
                    type="number"
                    value={form.scale_min}
                    onChange={(e) => updateField('scale_min', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#131315] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
                  Scale max
                  <input
                    type="number"
                    value={form.scale_max}
                    onChange={(e) => updateField('scale_max', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#131315] px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
                Flag threshold
                <input
                  type="number"
                  value={form.threshold}
                  onChange={(e) => updateField('threshold', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#131315] px-3 py-2 text-sm text-white"
                />
              </label>
            </>
          )}
          {form.input_type === 'radio' && (
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
              Options (comma-separated)
              <input
                value={form.optionsText}
                onChange={(e) => updateField('optionsText', e.target.value)}
                placeholder="Good, Fair, Poor"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#131315] px-3 py-2 text-sm text-white"
              />
            </label>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400">Cancel</button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(form).then(() => { setForm({ ...emptyForm }); onClose(); }).catch(() => {})}
            className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add question'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WellnessFormPanel() {
  const admin = useWellnessFormAdmin();
  const [showAdd, setShowAdd] = useState(false);
  const sorted = [...admin.items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Wellness Form</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Configure daily check-in questions for your organisation
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={admin.saving}
            onClick={() => admin.copyTemplate()}
            className="rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-300 disabled:opacity-50"
          >
            Copy default template
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-[#F97316] px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-black"
          >
            Add question
          </button>
        </div>
      </div>

      {admin.error && (
        <p className="mb-4 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-sm text-[#EF4444]">
          {admin.error}
        </p>
      )}

      {admin.loading ? (
        <div className="flex justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-2xl text-[#F97316]">progress_activity</span>
        </div>
      ) : sorted.length === 0 ? (
        <p className="rounded-lg bg-[#2a2a2c] px-4 py-8 text-center text-sm text-gray-500">
          No wellness questions configured. Copy the default template to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((item, index) => {
            const translations = parseLabelTranslations(item.label_translations);
            const threshold = admin.thresholds[item.key];
            return (
              <div
                key={item.id}
                className={`rounded-lg px-4 py-3 ${item.is_active ? 'bg-[#2a2a2c]' : 'bg-[#2a2a2c]/50 opacity-60'}`}
                style={{ border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">{item.label}</p>
                    {translations.hi && (
                      <p className="mt-0.5 text-xs text-gray-500">{translations.hi}</p>
                    )}
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-gray-600">
                      {item.key} · {item.input_type}
                      {!item.is_active && ' · inactive'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={admin.saving || index === 0} onClick={() => admin.moveItem(item, -1)} className="rounded p-1 text-gray-500 hover:text-white disabled:opacity-30">
                      <span className="material-symbols-outlined text-base">arrow_upward</span>
                    </button>
                    <button type="button" disabled={admin.saving || index === sorted.length - 1} onClick={() => admin.moveItem(item, 1)} className="rounded p-1 text-gray-500 hover:text-white disabled:opacity-30">
                      <span className="material-symbols-outlined text-base">arrow_downward</span>
                    </button>
                    <button
                      type="button"
                      disabled={admin.saving}
                      onClick={() => admin.toggleActive(item)}
                      className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400"
                    >
                      {item.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
                {['slider', 'number'].includes(item.input_type) && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      Flag threshold
                    </label>
                    <input
                      type="number"
                      defaultValue={threshold ?? ''}
                      onBlur={(e) => admin.saveThreshold(item.key, e.target.value)}
                      className="w-20 rounded border border-white/10 bg-[#131315] px-2 py-1 text-sm text-white"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddQuestionModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={admin.addItem}
        saving={admin.saving}
        inputTypes={admin.INPUT_TYPES}
        emptyForm={admin.EMPTY_FORM}
      />
    </div>
  );
}
