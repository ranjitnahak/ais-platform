import { useMemo, useState } from 'react';
import { SCORING_METHODS } from '../../lib/assessmentSettingsConstants';
import { formatTestingDate } from '../../lib/trendEngine';
import { athleteDisplayName } from '../../lib/athleteName';
import TestSelector, { FilterDropdown, selectClass } from './TestSelector';

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

function CheckboxFilter({ label, options, selectedIds, onChange }) {
  const count = selectedIds.length;
  const displayLabel = count ? `${label} (${count})` : label;
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

function ModeToggle({ value, onChange }) {
  return (
    <div className="ml-auto flex rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-1">
      {[
        { id: 'individual', label: 'Individual' },
        { id: 'squad', label: 'Squad' },
        { id: 'matrix', label: 'Matrix' },
      ].map((mode) => (
        <button
          key={mode.id}
          type="button"
          onClick={() => onChange(mode.id)}
          className={`rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
            value === mode.id
              ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
              : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

export default function AssessmentFilterBar({
  filters,
  setFilter,
  athletes,
  tests,
  testingDates,
  onExportPDF,
  exporting = false,
  exportError = null,
}) {
  const dateOptions = testingDates.map((s) => ({
    id: s.id,
    label: formatTestingDate(s.assessed_on),
  }));

  const athleteDisabled = filters.viewMode === 'squad' || filters.viewMode === 'matrix';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
      <AthleteFilter
        athletes={athletes}
        value={filters.athleteId}
        onChange={(id) => setFilter('athleteId', id)}
        disabled={athleteDisabled}
      />
      <TestSelector
        tests={tests}
        selectedIds={filters.testIds}
        onChange={(ids) => setFilter('testIds', ids)}
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
      {onExportPDF && (
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={onExportPDF}
            disabled={exporting}
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
                Export PDF
              </>
            )}
          </button>
          {exportError && (
            <p className="max-w-[12rem] text-right text-[10px] text-[var(--color-error)]">{exportError}</p>
          )}
        </div>
      )}
      <ModeToggle value={filters.viewMode} onChange={(mode) => setFilter('viewMode', mode)} />
    </div>
  );
}
