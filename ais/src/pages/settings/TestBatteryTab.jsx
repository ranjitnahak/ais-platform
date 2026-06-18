import { useState, useRef } from 'react';
import { useTestDefinitions } from '../../hooks/useTestDefinitions';

const INPUT_CLASS =
  'rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-background)] px-2 py-1 text-sm text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary-container)]';

function DirectionToggle({ direction, disabled, onToggle }) {
  const isHigher = direction !== 'lower_is_better';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={[
        'rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-widest transition-colors',
        isHigher
          ? 'bg-[color-mix(in_srgb,var(--color-excellent)_15%,transparent)] text-[var(--color-excellent)]'
          : 'bg-[color-mix(in_srgb,var(--color-above-avg)_15%,transparent)] text-[var(--color-above-avg)]',
      ].join(' ')}
    >
      {isHigher ? 'Higher is better' : 'Lower is better'}
    </button>
  );
}

function TestRow({
  test,
  canEdit,
  saving,
  dragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onUpdate,
  onDelete,
  onToggleDirection,
  onToggleActive,
}) {
  const [name, setName] = useState(test.name);
  const [unit, setUnit] = useState(test.unit ?? '');

  async function saveName() {
    if (name.trim() && name !== test.name) {
      await onUpdate(test.id, { name: name.trim() });
    } else {
      setName(test.name);
    }
  }

  async function saveUnit() {
    const trimmed = unit.trim();
    if (trimmed !== (test.unit ?? '')) {
      await onUpdate(test.id, { unit: trimmed || null });
    }
  }

  return (
    <div
      draggable={canEdit && !saving}
      onDragStart={(e) => onDragStart(e, test.id)}
      onDragOver={(e) => onDragOver(e, test.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, test.id)}
      onDragEnd={onDragEnd}
      className={[
        'flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 transition-colors',
        test.is_active === false ? 'opacity-60' : '',
        dragOver ? 'bg-[var(--color-surface-bright)]' : 'bg-[var(--color-surface-container-high)]',
      ].join(' ')}
      style={{ border: '1px solid var(--color-outline-variant)' }}
    >
      {canEdit && (
        <span
          className="cursor-grab text-[var(--color-on-surface-variant)] active:cursor-grabbing"
          title="Drag to reorder"
        >
          <span className="material-symbols-outlined text-base">drag_indicator</span>
        </span>
      )}
      <input
        type="text"
        value={name}
        disabled={!canEdit || saving}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => void saveName()}
        className={`min-w-[140px] flex-1 ${INPUT_CLASS}`}
      />
      <input
        type="text"
        value={unit}
        disabled={!canEdit || saving}
        onChange={(e) => setUnit(e.target.value)}
        onBlur={() => void saveUnit()}
        placeholder="unit"
        className={`w-20 ${INPUT_CLASS}`}
      />
      <DirectionToggle
        direction={test.direction}
        disabled={!canEdit || saving}
        onToggle={() => void onToggleDirection(test)}
      />
      <button
        type="button"
        disabled={!canEdit || saving}
        onClick={() => void onToggleActive(test)}
        className={[
          'rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-widest',
          test.is_active !== false
            ? 'border-[var(--color-excellent)] text-[var(--color-excellent)]'
            : 'border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)]',
        ].join(' ')}
      >
        {test.is_active !== false ? 'Active' : 'Inactive'}
      </button>
      {canEdit && (
        <button
          type="button"
          disabled={saving}
          onClick={() => void onDelete(test)}
          className="rounded p-1 text-[var(--color-on-surface-variant)] hover:text-[var(--color-error)]"
          title="Delete test"
        >
          <span className="material-symbols-outlined text-base">delete</span>
        </button>
      )}
      {test.team_id == null && (
        <span className="text-[9px] uppercase tracking-widest text-[var(--color-on-surface-variant)]">
          Org-wide
        </span>
      )}
    </div>
  );
}

function InlineAddRow({ saving, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const nameRef = useRef(null);

  async function handleSave() {
    if (!name.trim()) {
      onCancel();
      return;
    }
    try {
      await onSave({ name: name.trim(), unit: unit.trim() });
      setName('');
      setUnit('');
      onCancel();
    } catch {
      // error surfaced via toast
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--color-surface-container)] px-4 py-3"
      style={{ border: '1px solid var(--color-primary-container)' }}
    >
      <input
        ref={nameRef}
        autoFocus
        type="text"
        value={name}
        disabled={saving}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => void handleSave()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSave();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Test name"
        className={`min-w-[140px] flex-1 ${INPUT_CLASS}`}
      />
      <input
        type="text"
        value={unit}
        disabled={saving}
        onChange={(e) => setUnit(e.target.value)}
        onBlur={() => void handleSave()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSave();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="unit"
        className={`w-20 ${INPUT_CLASS}`}
      />
    </div>
  );
}

export default function TestBatteryTab({ selectedTeamId, onToast }) {
  const {
    tests,
    loading,
    saving,
    canEdit,
    createTest,
    updateTest,
    deleteTest,
    reorderTests,
  } = useTestDefinitions(selectedTeamId, { onError: (msg) => onToast?.(msg, 'error') });

  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const sorted = [...tests].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  function handleDragStart(e, id) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, id) {
    e.preventDefault();
    if (id !== dragId) setDragOverId(id);
  }

  function handleDragLeave() {
    setDragOverId(null);
  }

  async function handleDrop(e, targetId) {
    e.preventDefault();
    setDragOverId(null);
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const ids = sorted.map((t) => t.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragId);
    setDragId(null);
    try {
      await reorderTests(ids);
    } catch {
      // toast handled
    }
  }

  function handleDragEnd() {
    setDragId(null);
    setDragOverId(null);
  }

  async function handleToggleDirection(test) {
    const next = test.direction === 'lower_is_better' ? 'higher_is_better' : 'lower_is_better';
    try {
      await updateTest(test.id, { direction: next });
    } catch {
      // toast handled
    }
  }

  async function handleToggleActive(test) {
    try {
      await updateTest(test.id, { is_active: test.is_active === false });
    } catch {
      // toast handled
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-on-surface)]">Test Battery</h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-on-surface-variant)]">
            Configure performance tests for the selected team
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            disabled={saving || adding || !selectedTeamId}
            onClick={() => setAdding(true)}
            className="rounded-lg bg-[var(--color-primary-container)] px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50"
          >
            + Add test
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-2xl text-[var(--color-primary-container)]">
            progress_activity
          </span>
        </div>
      ) : !selectedTeamId ? (
        <p className="rounded-lg bg-[var(--color-surface-container-high)] px-4 py-6 text-center text-sm text-[var(--color-on-surface-variant)]">
          Select a team to manage tests.
        </p>
      ) : sorted.length === 0 && !adding ? (
        <p className="rounded-lg bg-[var(--color-surface-container-high)] px-4 py-6 text-center text-sm text-[var(--color-on-surface-variant)]">
          No tests configured. Add a test to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((test) => (
            <TestRow
              key={test.id}
              test={test}
              canEdit={canEdit}
              saving={saving}
              dragOver={dragOverId === test.id}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onUpdate={updateTest}
              onDelete={deleteTest}
              onToggleDirection={handleToggleDirection}
              onToggleActive={handleToggleActive}
            />
          ))}
          {adding && (
            <InlineAddRow
              saving={saving}
              onSave={createTest}
              onCancel={() => setAdding(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
