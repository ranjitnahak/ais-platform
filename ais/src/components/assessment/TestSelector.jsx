import { useState } from 'react';

const selectClass =
  'min-h-10 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-3 text-xs font-bold outline-none text-[var(--color-on-surface)]';

function FilterDropdown({ label, children, className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${selectClass} flex min-w-[140px] items-center justify-between gap-2`}
      >
        <span className="truncate">{label}</span>
        <span className="material-symbols-outlined text-base">expand_more</span>
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close filter"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-1 max-h-64 min-w-[220px] overflow-y-auto rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-2 shadow-xl">
            {children({ close: () => setOpen(false) })}
          </div>
        </>
      )}
    </div>
  );
}

export default function TestSelector({ tests, selectedIds, onChange }) {
  const options = tests.map((t) => ({ id: t.id, label: t.name }));
  const count = selectedIds.length;
  const displayLabel = count ? `Tests (${count})` : 'Tests';
  const allIds = options.map((opt) => opt.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

  return (
    <FilterDropdown label={displayLabel}>
      {() => (
        <div className="space-y-1">
          {allIds.length > 0 && (
            <button
              type="button"
              className="mb-1 w-full rounded-lg border-b border-[var(--color-outline-variant)] px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-widest text-[var(--color-primary-container)] hover:bg-[var(--color-surface)]"
              onClick={() => onChange(allSelected ? [] : allIds)}
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
          {options.map((opt) => {
            const checked = selectedIds.includes(opt.id);
            return (
              <label
                key={opt.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-[var(--color-surface)]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    onChange(
                      checked ? selectedIds.filter((id) => id !== opt.id) : [...selectedIds, opt.id],
                    );
                  }}
                  className="accent-[var(--color-primary-container)]"
                />
                <span className="font-bold text-[var(--color-on-surface)]">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </FilterDropdown>
  );
}

export { FilterDropdown, selectClass };
