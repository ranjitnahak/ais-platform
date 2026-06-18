import { useCallback, useEffect, useRef, useState } from 'react';
import { canSync } from '../../lib/auth';
import { useUser } from '../../context/UserContext';
import { useAssessmentGrid } from '../../hooks/useAssessmentGrid';
import LogSkeleton from '../../components/shared/skeletons/LogSkeleton';

const INPUT_CLASS =
  'w-full min-w-0 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-background)] px-2 py-1.5 text-sm text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary-container)]';

function ToastBanner({ toast, onDismiss }) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div
      className={[
        'fixed bottom-24 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-bold',
        isError
          ? 'border border-[var(--color-error)] bg-[var(--color-surface-container-high)] text-[var(--color-error)]'
          : 'border border-[var(--color-primary-container)] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)]',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <span className="flex-1">{toast.message}</span>
        <button type="button" onClick={onDismiss} className="text-[var(--color-on-surface-variant)]">
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  );
}

function StatusDot({ status }) {
  const color =
    status === 'green'
      ? 'var(--color-tertiary)'
      : status === 'amber'
        ? 'var(--color-primary-container)'
        : 'var(--color-outline)';
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: color }}
      title={status === 'green' ? 'Complete' : status === 'amber' ? 'Partial' : 'Empty'}
    />
  );
}

function cellClassName(status) {
  const base = 'w-full min-w-[4.5rem] rounded border px-2 py-1 text-sm text-[var(--color-on-surface)] outline-none';
  if (status === 'dirty') {
    return `${base} border-[var(--color-secondary-container)] bg-[var(--color-surface-container-high)]`;
  }
  if (status === 'saved') {
    return `${base} border-[var(--color-outline-variant)] bg-[color-mix(in_srgb,var(--color-primary-container)_12%,var(--color-surface-container-high))]`;
  }
  if (status === 'flagged') {
    return `${base} border-[var(--color-primary-container)] bg-[var(--color-surface-container-high)]`;
  }
  return `${base} border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)]`;
}

function FilterDropdown({ label, children, open, onToggle }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-9 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-3 text-xs font-bold text-[var(--color-on-surface)]"
      >
        {label}
        <span className="material-symbols-outlined text-sm text-[var(--color-outline)]">
          expand_more
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 min-w-[12rem] overflow-y-auto rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-2 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

export default function AssessmentTab() {
  const { user } = useUser();
  const canCreate = canSync(user, 'assessments', 'create') || Boolean(user?.isSuperuser);
  const [toast, setToast] = useState(null);
  const [athletesOpen, setAthletesOpen] = useState(false);
  const [testsOpen, setTestsOpen] = useState(false);
  const fileInputRef = useRef(null);

  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const grid = useAssessmentGrid({ onToast: showToast });

  if (!canCreate) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center">
        <span className="material-symbols-outlined text-5xl text-[var(--color-outline)]">lock</span>
        <h2 className="mt-4 text-xl font-black text-[var(--color-on-surface)]">Assessment entry</h2>
        <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
          You need create permission on assessments to enter scores.
        </p>
      </div>
    );
  }

  const athleteLabel = grid.wholeTeam
    ? `Athletes: Whole team (${grid.roster.length})`
    : `Athletes: ${grid.selectedAthleteIds.length} selected`;

  const testLabel = `Tests: ${grid.selectedTestIds.length} of ${grid.activeTests.length}`;

  const progressPct =
    grid.progress.total > 0
      ? Math.round((grid.progress.complete / grid.progress.total) * 100)
      : 0;

  function handleGroupDateChange(nextDate) {
    if (
      grid.hasUnsavedChanges &&
      !window.confirm('You have unsaved changes. Change date anyway?')
    ) {
      return;
    }
    grid.setGroupDate(nextDate);
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
        <div className="min-w-[10rem]">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
            Testing date
          </label>
          <input
            type="date"
            value={grid.groupDate}
            onChange={(e) => handleGroupDateChange(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <FilterDropdown
          label={athleteLabel}
          open={athletesOpen}
          onToggle={() => setAthletesOpen((o) => !o)}
        >
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold hover:bg-[var(--color-surface-container-high)]">
            <input
              type="checkbox"
              checked={grid.wholeTeam}
              onChange={(e) => grid.setAthleteWholeTeam(e.target.checked)}
            />
            Whole team
          </label>
          {grid.roster.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-[var(--color-surface-container-high)]"
            >
              <input
                type="checkbox"
                checked={grid.wholeTeam || grid.selectedAthleteIds.includes(a.id)}
                disabled={grid.wholeTeam}
                onChange={() => grid.toggleAthlete(a.id)}
              />
              {a.full_name}
            </label>
          ))}
        </FilterDropdown>

        <FilterDropdown
          label={testLabel}
          open={testsOpen}
          onToggle={() => setTestsOpen((o) => !o)}
        >
          {grid.activeTests.map((test) => (
            <label
              key={test.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-[var(--color-surface-container-high)]"
            >
              <input
                type="checkbox"
                checked={grid.selectedTestIds.includes(test.id)}
                onChange={() => grid.toggleTest(test.id)}
              />
              {test.name}
              {test.unit && (
                <span className="text-[10px] text-[var(--color-on-surface-variant)]">({test.unit})</span>
              )}
            </label>
          ))}
        </FilterDropdown>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {grid.hasUnsavedChanges && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-secondary-container)]">
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            onClick={() => grid.exportCsv()}
            disabled={!grid.roster.length}
            className="rounded-lg border border-[var(--color-outline-variant)] px-3 py-2 text-xs font-bold uppercase tracking-widest text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-high)]"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-[var(--color-outline-variant)] px-3 py-2 text-xs font-bold uppercase tracking-widest text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-high)]"
          >
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              void grid.handleImportFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => void grid.saveAll()}
            disabled={grid.saving || !grid.hasUnsavedChanges}
            className="rounded-lg bg-[var(--color-primary-container)] px-3 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary-container)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {grid.saving ? 'Saving…' : 'Save all'}
          </button>
        </div>
      </div>

      {/* Import preview */}
      {grid.importPreview && (
        <div className="rounded-2xl border border-[var(--color-primary-container)] bg-[color-mix(in_srgb,var(--color-primary-container)_8%,var(--color-surface-container))] p-4">
          <p className="text-sm font-bold text-[var(--color-on-surface)]">
            Import preview: {grid.importFileName}
          </p>
          <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
            {grid.importPreview.athleteCount} athletes · {grid.importPreview.testCount} tests ·{' '}
            {grid.importPreview.flaggedCount} flagged values
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={grid.cancelImport}
              className="rounded-lg border border-[var(--color-outline-variant)] px-3 py-1.5 text-xs font-bold text-[var(--color-on-surface)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void grid.confirmImport()}
              disabled={grid.saving}
              className="rounded-lg bg-[var(--color-primary-container)] px-3 py-1.5 text-xs font-black text-[var(--color-on-primary-container)]"
            >
              Confirm import
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      {grid.progress.total > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
            <span>
              {grid.progress.complete} of {grid.progress.total} athletes complete
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-container-high)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary-container)] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Grid */}
      {grid.loading ? (
        <LogSkeleton />
      ) : !grid.activeTeamId ? (
        <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6 text-center text-sm text-[var(--color-on-surface-variant)]">
          Select a team from the header to enter assessment scores.
        </p>
      ) : !grid.rows.length ? (
        <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6 text-center text-sm text-[var(--color-on-surface-variant)]">
          No athletes selected.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--color-outline-variant)]">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)]">
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                  Athlete
                </th>
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                  Date
                </th>
                {grid.visibleTests.map((test) => (
                  <th
                    key={test.id}
                    className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]"
                  >
                    {test.short_name || test.name}
                  </th>
                ))}
                <th className="w-10 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr
                  key={row.athleteId}
                  className="border-b border-[var(--color-outline-variant)] last:border-b-0"
                >
                  <td className="px-3 py-2 font-bold text-[var(--color-on-surface)]">{row.fullName}</td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => void grid.setRowDate(row.athleteId, e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </td>
                  {grid.visibleTests.map((test) => {
                    const cell = row.cells[test.id] ?? { value: '', status: 'empty' };
                    return (
                      <td key={test.id} className="px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          value={cell.value}
                          onChange={(e) => grid.updateCellValue(row.athleteId, test.id, e.target.value)}
                          className={cellClassName(cell.status)}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center">
                    <StatusDot status={grid.rowCompletionStatus(row)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
