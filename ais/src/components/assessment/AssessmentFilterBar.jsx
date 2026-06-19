import { useMemo, useState } from 'react';
import { SCORING_METHODS } from '../../lib/assessmentSettingsConstants';
import { formatTestingDate } from '../../lib/trendEngine';
import { athleteDisplayName } from '../../lib/athleteName';

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

function AthleteFilter({ athletes, value, onChange, disabled }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) => athleteDisplayName(a).toLowerCase().includes(q));
  }, [athletes, query]);

  const label = value
    ? athleteDisplayName(athletes.find((a) => a.id === value) ?? {})
    : 'Athlete';

  if (disabled) {
    return (
      <div className={`${selectClass} min-w-[140px] opacity-50`} aria-disabled>
        Athlete
      </div>
    );
  }

  return (
    <FilterDropdown label={label}>
      {({ close }) => (
        <div className="space-y-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 py-2 text-xs outline-none"
          />
          <button
            type="button"
            className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface)]"
            onClick={() => {
              onChange(null);
              close();
            }}
          >
            Clear selection
          </button>
          {filtered.map((athlete) => (
            <button
              key={athlete.id}
              type="button"
              className={`w-full rounded-lg px-2 py-1.5 text-left text-xs font-bold hover:bg-[var(--color-surface)] ${
                value === athlete.id ? 'bg-[var(--color-surface)] text-[var(--color-primary-container)]' : 'text-[var(--color-on-surface)]'
              }`}
              onClick={() => {
                onChange(athlete.id);
                close();
              }}
            >
              {athleteDisplayName(athlete)}
            </button>
          ))}
        </div>
      )}
    </FilterDropdown>
  );
}

function CheckboxFilter({ label, options, selectedIds, onChange, singleSelect = false }) {
  const count = selectedIds.length;
  const displayLabel = count ? `${label} (${count})` : label;
  const allIds = options.map((opt) => opt.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

  return (
    <FilterDropdown label={displayLabel}>
      {({ close }) => (
        <div className="space-y-1">
          {!singleSelect && allIds.length > 0 && (
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
                  type={singleSelect ? 'radio' : 'checkbox'}
                  name={singleSelect ? label : opt.id}
                  checked={checked}
                  onChange={() => {
                    if (singleSelect) {
                      onChange([opt.id]);
                      close();
                    } else {
                      onChange(
                        checked ? selectedIds.filter((id) => id !== opt.id) : [...selectedIds, opt.id],
                      );
                    }
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

function ModeToggle({ value, onChange }) {
  return (
    <div className="ml-auto flex rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-1">
      {['individual', 'squad'].map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
            value === mode
              ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
              : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
          }`}
        >
          {mode === 'individual' ? 'Individual' : 'Squad'}
        </button>
      ))}
    </div>
  );
}

export default function AssessmentFilterBar({ filters, setFilter, athletes, tests, testingDates }) {
  const testOptions = tests.map((t) => ({ id: t.id, label: t.name }));
  const dateOptions = testingDates.map((s) => ({
    id: s.id,
    label: formatTestingDate(s.assessed_on),
  }));

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
      <AthleteFilter
        athletes={athletes}
        value={filters.athleteId}
        onChange={(id) => setFilter('athleteId', id)}
        disabled={filters.viewMode === 'squad'}
      />
      <CheckboxFilter
        label="Tests"
        options={testOptions}
        selectedIds={filters.testIds}
        onChange={(ids) => setFilter('testIds', ids)}
        singleSelect={filters.viewMode === 'squad'}
      />
      <CheckboxFilter
        label="Testing dates"
        options={dateOptions}
        selectedIds={filters.sessionIds}
        onChange={(ids) => setFilter('sessionIds', ids)}
      />
      <select
        value={filters.scoringMethod}
        onChange={(e) => setFilter('scoringMethod', e.target.value)}
        className={selectClass}
        aria-label="Scoring method"
      >
        {SCORING_METHODS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <ModeToggle value={filters.viewMode} onChange={(mode) => setFilter('viewMode', mode)} />
    </div>
  );
}
