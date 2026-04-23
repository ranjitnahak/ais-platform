import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useResizeDrag from '../../hooks/useResizeDrag';
import useSpanDrag from '../../hooks/useSpanDrag';
import PeriodisationToolbar from './PeriodisationToolbar';
import PeriodisationGrid from './PeriodisationGrid';
import PeriodisationPDFExport from './PeriodisationPDFExport';
import { compositeKey, getCellForWeek } from './cellUtils';
import {
  weekStartsBetween,
  addDays,
  rowMetricKey,
  computeAcwrSeries,
  numberCellStyle,
  ROW_GROUPS,
  ZOOM_PX,
} from '../../lib/periodisationUtils';
import ColorPicker from '../ui/ColorPicker';

const LEFT_COL = 140;

const ROW_TYPE_OPTIONS = [
  {
    row_type: 'band',
    title: 'Phase band',
    desc: 'Drag to paint colored spans, e.g. Pre-season, Competition',
  },
  {
    row_type: 'text',
    title: 'Text / label',
    desc: 'Type short labels per week or spanning, e.g. Primary focus',
  },
  {
    row_type: 'number',
    title: 'Number (1–10)',
    desc: 'Click to set a value 1–10 per week, e.g. Volume, Intensity',
  },
  {
    row_type: 'marker',
    title: 'Event marker',
    desc: 'Single dot markers per week, e.g. Match day, Travel',
  },
  {
    row_type: 'toggle',
    title: 'On/Off toggle',
    desc: 'On/off per week, e.g. Recovery week, Holiday',
  },
];

function formatPlanDate(iso) {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function PeriodisationCanvas({
  plan,
  rows,
  cells,
  ghostRows = [],
  ghostCells = [],
  showTeamPlan = 'on',
  setShowTeamPlan,
  teams,
  selectedTeamId,
  setSelectedTeamId,
  viewMode,
  setViewMode,
  athletes,
  selectedAthleteId,
  setSelectedAthleteId,
  zoomLevel,
  setZoomLevel,
  canEdit,
  upsertCell,
  deletePlanCellById,
  insertPlanRow,
  deletePlanRow,
  updatePlanRow,
  reorderPlanRows,
  reorderPlanRowsWithGroups,
  updateDisplayLabelForGroup,
  onWeekSelect,
  templates = [],
}) {
  const hasIndividualPlan = viewMode === 'individual' && plan?.id != null;

  const patchesRef = useRef({});
  const pdfExportRef = useRef(null);

  // Grid state
  const [collapsed, setCollapsed] = useState({});
  const [chartOpen, setChartOpen] = useState(true);
  const [patches, setPatches] = useState({});
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'unsaved' | 'saving'
  const [, setHistory] = useState([]);
  const [, setFuture] = useState([]);

  // PDF export state
  const [isExporting, setIsExporting] = useState(false);

  // Menus / popovers
  const [ctxMenu, setCtxMenu] = useState(null);       // row label right-click
  const [bandCtxMenu, setBandCtxMenu] = useState(null); // band / focus-span right-click
  const [addRowModal, setAddRowModal] = useState(null); // { group, rowType?, name?, insertCtx? }
  const [editingGroupHeader, setEditingGroupHeader] = useState(null); // { groupKey, value }
  const [numPopover, setNumPopover] = useState(null); // number picker: { rowId, monday, current, x, y }

  // Row drag-to-reorder
  const [dragRowId, setDragRowId] = useState(null);
  const [dragOverRowId, setDragOverRowId] = useState(null);
  const dragRowIdRef = useRef(null);

  // Inline row label edit
  const [editingRowLabel, setEditingRowLabel] = useState(null); // { rowId, value }

  useEffect(() => {
    patchesRef.current = patches;
  }, [patches]);

  const weeks = useMemo(
    () => weekStartsBetween(plan.start_date, plan.end_date),
    [plan.start_date, plan.end_date]
  );

  const pxPerWeek = ZOOM_PX[zoomLevel] ?? 52;
  const gridWidth = weeks.length * pxPerWeek;
  const totalWidth = LEFT_COL + gridWidth;

  const effectiveRows = useMemo(() => {
    if (rows.length > 0) return rows;
    // When athlete has no individual plan, always show ghost rows
    // as the row structure regardless of toggle state
    if (viewMode === 'individual' && ghostRows.length > 0) {
      return ghostRows;
    }
    return rows;
  }, [rows, ghostRows, viewMode]);

  const effectiveCells = useMemo(() => {
    if (rows.length > 0) return cells;
    // When athlete has no individual plan, show ghost cells
    // only when toggle is on or ghost — hide when off
    if (viewMode === 'individual' && ghostRows.length > 0) {
      return showTeamPlan !== 'off' ? ghostCells : [];
    }
    return cells;
  }, [rows, cells, ghostCells, ghostRows, viewMode, showTeamPlan]);

  const ghostOpacity = useMemo(() => {
    if (viewMode !== 'athlete') return 1;
    if (rows.length > 0) return 1; // athlete has own plan — opacity handled by overlay
    if (showTeamPlan === 'ghost') return 0.5;
    return 1;
  }, [viewMode, rows.length, showTeamPlan]);

  const rowsByGroup = useMemo(() => {
    const m = {};
    for (const g of ROW_GROUPS) m[g] = [];
    for (const r of effectiveRows) {
      const g = ROW_GROUPS.includes(r.row_group) ? r.row_group : 'Planning';
      if (!m[g]) m[g] = [];
      m[g].push(r);
    }
    return m;
  }, [effectiveRows]);

  const ghostCellMap = useMemo(() => {
    if (showTeamPlan === 'off' || !ghostCells.length) return {};
    const map = {};
    for (const c of ghostCells) {
      const key = `${c.row_id}|${c.cell_date}`;
      map[key] = c;
    }
    return map;
  }, [ghostCells, showTeamPlan]);

  // Map ghost rows by their row_key or label for matching with
  // current plan rows
  const ghostRowByKey = useMemo(() => {
    const map = {};
    for (const r of ghostRows) {
      const k = r.row_key || r.label;
      if (k) map[k] = r;
    }
    return map;
  }, [ghostRows]);

  const volumeRow = effectiveRows.find((r) => rowMetricKey(r) === 'volume');
  const intensityRow = effectiveRows.find((r) => rowMetricKey(r) === 'intensity');

  const weeklyLoads = useMemo(() => {
    return weeks.map((w) => {
      const v = volumeRow ? getCellForWeek(volumeRow.id, w.monday, effectiveCells, patches)?.value_number : null;
      const i = intensityRow ? getCellForWeek(intensityRow.id, w.monday, effectiveCells, patches)?.value_number : null;
      if (v == null && i == null) return null;
      return ((Number(v) || 0) + (Number(i) || 0)) / 2;
    });
  }, [weeks, volumeRow, intensityRow, effectiveCells, patches]);

  const acwrSeries = useMemo(() => computeAcwrSeries(weeklyLoads), [weeklyLoads]);

  const chartData = useMemo(() => {
    const vol = weeks.map((w) =>
      volumeRow ? getCellForWeek(volumeRow.id, w.monday, effectiveCells, patches)?.value_number ?? null : null
    );
    const ints = weeks.map((w) =>
      intensityRow ? getCellForWeek(intensityRow.id, w.monday, effectiveCells, patches)?.value_number ?? null : null
    );
    const ac = acwrSeries.map((r) => (r == null ? null : Math.min(10, Number(r) * 4)));
    return {
      labels: weeks.map((_, i) => `W${i + 1}`),
      datasets: [
        {
          label: 'Volume',
          data: vol,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          fill: true,
          tension: 0.25,
          pointRadius: 3,
        },
        {
          label: 'Intensity',
          data: ints,
          borderColor: '#F97316',
          backgroundColor: 'rgba(249,115,22,0.06)',
          fill: true,
          tension: 0.25,
          pointRadius: 3,
        },
        {
          label: 'ACWR',
          data: ac,
          borderColor: '#22c55e',
          borderDash: [6, 4],
          fill: false,
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    };
  }, [weeks, volumeRow, intensityRow, effectiveCells, patches, acwrSeries]);

  // Derived values for PDF export
  const teamName = useMemo(
    () => teams.find((t) => t.id === selectedTeamId)?.name ?? '',
    [teams, selectedTeamId],
  );
  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  /** Same cell resolution as the grid (persisted rows + in-flight patches) for PDF export. */
  const cellsSnapshotForPdf = useMemo(() => {
    const map = new Map(
      cells.map((c) => [compositeKey(c.row_id, c.cell_date), { ...c }]),
    );
    for (const [k, v] of Object.entries(patches)) {
      if (v === null) map.delete(k);
      else map.set(k, { ...(map.get(k) ?? {}), ...v });
    }
    return [...map.values()];
  }, [cells, patches]);

  const loadWaveData = useMemo(() => {
    const vol = weeks.map((w) =>
      volumeRow ? getCellForWeek(volumeRow.id, w.monday, effectiveCells, patches)?.value_number ?? null : null,
    );
    const ints = weeks.map((w) =>
      intensityRow ? getCellForWeek(intensityRow.id, w.monday, effectiveCells, patches)?.value_number ?? null : null,
    );
    return {
      labels: weeks.map((_, i) => `W${i + 1}`),
      volume: vol,
      intensity: ints,
      acwr: acwrSeries,
    };
  }, [weeks, volumeRow, intensityRow, effectiveCells, patches, acwrSeries]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: '#d1d5db', font: { size: 10 } } },
      },
      scales: {
        x: { ticks: { color: '#9ca3af', maxRotation: 0, font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
        y: { min: 0, max: 10, ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.06)' } },
      },
    }),
    []
  );

  const snapshotHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-49), JSON.stringify(patchesRef.current)]);
    setFuture([]);
  }, []);

  const patchCell = useCallback(
    (rowId, monday, cellOrNull) => {
      snapshotHistory();
      const k = compositeKey(rowId, monday);
      setPatches((p) => {
        const next = { ...p };
        if (cellOrNull === undefined) delete next[k];
        else next[k] = cellOrNull;
        return next;
      });
    },
    [snapshotHistory]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (!canEdit) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        setHistory((h) => {
          if (!h.length) return h;
          const prev = JSON.parse(h[h.length - 1]);
          setFuture((f) => [JSON.stringify(patchesRef.current), ...f]);
          setPatches(prev);
          return h.slice(0, -1);
        });
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        setFuture((f) => {
          if (!f.length) return f;
          const n = JSON.parse(f[0]);
          setHistory((h) => [...h.slice(-49), JSON.stringify(patchesRef.current)]);
          setPatches(n);
          return f.slice(1);
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit]);

  const flushSave = async () => {
    const entries = Object.entries(patches);
    for (const [k, val] of entries) {
      const [rowId, monday] = k.split('|');
      if (val === null) {
        const existing = cells.find((c) => c.row_id === rowId && c.cell_date === monday);
        if (existing?.id) await deletePlanCellById(existing.id);
        continue;
      }
      const { org_id: _o, ...rest } = val;
      await upsertCell({ ...rest, row_id: rowId, cell_date: rest.cell_date ?? monday });
    }
    setPatches({});
    setHistory([]);
    setFuture([]);
  };

  useEffect(() => {
    if (!Object.keys(patches).length) return;
    setSaveStatus('unsaved');
    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      await flushSave();
      setSaveStatus('saved');
    }, 1500);
    return () => clearTimeout(timer);
  // flushSave is a plain function recreated each render — it always closes over
  // the current patches, so we don't need it in the dep array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patches]);

  const monthSpans = useMemo(() => {
    const spans = [];
    if (!weeks.length) return spans;
    let i = 0;
    while (i < weeks.length) {
      const d = new Date(weeks[i].monday + 'T12:00:00');
      const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      let j = i + 1;
      while (j < weeks.length) {
        const d2 = new Date(weeks[j].monday + 'T12:00:00');
        if (d2.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) !== label) break;
        j++;
      }
      spans.push({ startIdx: i, endIdx: j - 1, label, cols: j - i });
      i = j;
    }
    return spans;
  }, [weeks]);

  const onHeaderClick = (idx) => {
    const w = weeks[idx];
    if (!w) return;
    onWeekSelect({ weekIndex: idx, weekStartIso: w.monday, weekEndIso: addDays(w.monday, 6) });
  };

  // ── Row drag-to-reorder ──────────────────────────────────────────────────
  const handleRowDragStart = (e, rowId) => {
    dragRowIdRef.current = rowId;
    setDragRowId(rowId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', rowId);
  };

  const handleRowDragOver = (e, rowId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (rowId !== dragRowIdRef.current) setDragOverRowId(rowId);
  };

  const handleRowDrop = async (e, targetRow) => {
    e.preventDefault();
    const srcId = dragRowIdRef.current;
    setDragRowId(null);
    setDragOverRowId(null);
    dragRowIdRef.current = null;
    if (!srcId || srcId === targetRow.id) return;

    const srcRow = rows.find((r) => r.id === srcId);
    if (!srcRow) return;

    let ordered = [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    let fromIdx = ordered.findIndex((r) => r.id === srcId);
    let toIdx = ordered.findIndex((r) => r.id === targetRow.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = ordered.splice(fromIdx, 1);
    if (fromIdx < toIdx) toIdx -= 1;
    const newGroup = targetRow.row_group;
    ordered.splice(toIdx, 0, { ...moved, row_group: newGroup });

    if (reorderPlanRowsWithGroups) {
      await reorderPlanRowsWithGroups(ordered.map((r) => ({ id: r.id, row_group: r.row_group })));
    } else {
      await reorderPlanRows?.(ordered.map((r) => r.id));
    }
  };

  const handleRowDragEnd = () => {
    setDragRowId(null);
    setDragOverRowId(null);
    dragRowIdRef.current = null;
  };

  // ── Close all floating UI on outer click ────────────────────────────────
  const closeAll = () => {
    if (justFinishedDragRef.current) return;
    setCtxMenu(null);
    setBandCtxMenu(null);
    setNumPopover(null);
    setSpanPopover(null);
    setSpanSelection(null);
    setAddRowModal(null);
    setEditingGroupHeader(null);
  };

  const { resizeDragRef, resizingCell, onResizeMouseDown } = useResizeDrag({
    canEdit,
    pxPerWeek,
    weeks,
    patchCell,
  });

  const {
    spanDragRef,
    justFinishedDragRef,
    spanSelection,
    setSpanSelection,
    spanPopover,
    setSpanPopover,
    onSpanPointerDown,
    onSpanPointerEnter,
    dismissSpanPopover,
    saveSpanPopover,
  } = useSpanDrag({ canEdit, weeks, upsertCell, resizeDragRef });

  const completeAddRow = async () => {
    if (!addRowModal?.rowType || !addRowModal?.name?.trim()) return;
    const name = addRowModal.name.trim();
    const group = addRowModal.group ?? 'Planning';
    const { rowType, insertCtx } = addRowModal;
    let sortOrder = 0;
    if (insertCtx) {
      const { anchorRow, position } = insertCtx;
      const target = (anchorRow.sort_order ?? 0) + (position === 'below' ? 1 : 0);
      const toShift = rows
        .filter((x) => (x.sort_order ?? 0) >= target)
        .sort((a, b) => (b.sort_order ?? 0) - (a.sort_order ?? 0));
      for (const r of toShift) {
        await updatePlanRow(r.id, { sort_order: (r.sort_order ?? 0) + 1 });
      }
      sortOrder = target;
    } else {
      sortOrder = Math.max(-1, ...rows.map((r) => r.sort_order ?? 0)) + 1;
    }
    await insertPlanRow({
      row_group: group,
      label: name,
      row_type: rowType,
      sort_order: sortOrder,
    });
    setAddRowModal(null);
  };

  const planDateRange =
    plan?.start_date && plan?.end_date
      ? `${formatPlanDate(plan.start_date)} — ${formatPlanDate(plan.end_date)}`
      : '';

  const dragSrcRow = dragRowId ? rows.find((r) => r.id === dragRowId) : null;
  const dragTgtRow = dragOverRowId ? rows.find((r) => r.id === dragOverRowId) : null;
  const crossGroupDrop =
    !!dragSrcRow &&
    !!dragTgtRow &&
    dragSrcRow.row_group !== dragTgtRow.row_group &&
    !!dragRowId &&
    !!dragOverRowId &&
    dragRowId !== dragOverRowId;

  return (
    <div className="space-y-3 text-[#e4e2e4]" onClick={closeAll}>
      {/* Plan date range subtitle — issue #5 */}
      {planDateRange && (
        <p className="text-[12px] text-gray-500 leading-none">{planDateRange}</p>
      )}

      {/* PDF export orchestrator — renders nothing visible */}
      <PeriodisationPDFExport
        ref={pdfExportRef}
        plan={plan}
        rows={rows}
        cells={cellsSnapshotForPdf}
        weeks={weeks}
        teamName={teamName}
        teamLogoUrl={selectedTeam?.logo_url ?? null}
        loadWaveData={loadWaveData}
        athleteName={
          viewMode === 'individual' && selectedAthleteId
            ? (athletes.find((a) => a.id === selectedAthleteId)?.full_name ?? null)
            : null
        }
        athletePhotoUrl={
          viewMode === 'individual' && selectedAthleteId
            ? (athletes.find((a) => a.id === selectedAthleteId)?.photo_url ?? null)
            : null
        }
        athletePosition={
          viewMode === 'individual' && selectedAthleteId
            ? (athletes.find((a) => a.id === selectedAthleteId)?.position ?? null)
            : null
        }
        onExportStart={() => setIsExporting(true)}
        onExportComplete={() => setIsExporting(false)}
        onExportError={(err) => { setIsExporting(false); console.error('PDFExport: ', err); }}
      />

      {/* Top bar */}
      <PeriodisationToolbar
        teams={teams}
        selectedTeamId={selectedTeamId}
        setSelectedTeamId={setSelectedTeamId}
        viewMode={viewMode}
        setViewMode={setViewMode}
        athletes={athletes}
        selectedAthleteId={selectedAthleteId}
        setSelectedAthleteId={setSelectedAthleteId}
        hasIndividualPlan={hasIndividualPlan}
        showTeamPlan={showTeamPlan}
        setShowTeamPlan={setShowTeamPlan}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        canEdit={canEdit}
        patches={patches}
        onAddRow={() => setAddRowModal({ group: 'Planning', rowType: undefined, name: '' })}
        templates={templates}
        saveStatus={saveStatus}
        flushSave={flushSave}
        onExportPDF={() => pdfExportRef.current?.exportToPDF()}
        isExporting={isExporting}
      />

      <PeriodisationGrid
        weeks={weeks}
        pxPerWeek={pxPerWeek}
        gridWidth={gridWidth}
        totalWidth={totalWidth}
        LEFT_COL={LEFT_COL}
        monthSpans={monthSpans}
        ROW_GROUPS={ROW_GROUPS}
        rowsByGroup={rowsByGroup}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        editingGroupHeader={editingGroupHeader}
        setEditingGroupHeader={setEditingGroupHeader}
        updateDisplayLabelForGroup={updateDisplayLabelForGroup}
        canEdit={canEdit}
        dragRowId={dragRowId}
        dragOverRowId={dragOverRowId}
        handleRowDragStart={handleRowDragStart}
        handleRowDragOver={handleRowDragOver}
        handleRowDrop={handleRowDrop}
        handleRowDragEnd={handleRowDragEnd}
        editingRowLabel={editingRowLabel}
        setEditingRowLabel={setEditingRowLabel}
        updatePlanRow={updatePlanRow}
        ghostOpacity={ghostOpacity}
        showTeamPlan={showTeamPlan}
        viewMode={viewMode}
        rows={rows}
        ghostRowByKey={ghostRowByKey}
        ghostCellMap={ghostCellMap}
        ghostCells={ghostCells}
        acwrSeries={acwrSeries}
        effectiveCells={effectiveCells}
        patches={patches}
        resizingCell={resizingCell}
        spanSelection={spanSelection}
        onSpanPointerDown={onSpanPointerDown}
        onSpanPointerEnter={onSpanPointerEnter}
        patchCell={patchCell}
        onResizeMouseDown={onResizeMouseDown}
        setBandCtxMenu={setBandCtxMenu}
        setNumPopover={setNumPopover}
        setCtxMenu={setCtxMenu}
        onHeaderClick={onHeaderClick}
        chartOpen={chartOpen}
        setChartOpen={setChartOpen}
        chartData={chartData}
        chartOptions={chartOptions}
        crossGroupDrop={crossGroupDrop}
      />

      {/* ── Phase span popover: fixed to anchor cell (avoids overflow-x clip); z-index 1000 ─ */}
      {spanPopover && canEdit && spanPopover.anchorRect && (
        <div
          className="bg-[#2a2a2c] border border-white/10 rounded-lg shadow-2xl p-2 w-[min(260px,calc(100vw-24px))]"
          style={{
            position: 'fixed',
            zIndex: 1000,
            left: Math.min(spanPopover.anchorRect.left, window.innerWidth - 272),
            top: spanPopover.anchorRect.bottom + 6,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <input
              autoFocus
              placeholder={spanPopover.mode === 'band' ? 'Phase name...' : 'Label...'}
              value={spanPopover.name}
              onChange={(e) => setSpanPopover((p) => (p ? { ...p, name: e.target.value } : p))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void saveSpanPopover();
                }
              }}
              className="flex-1 min-w-0 bg-[#1C1C1E] border border-white/10 rounded px-2 py-1.5 text-xs text-white"
            />
            <button
              type="button"
              className="shrink-0 w-7 h-7 rounded text-gray-400 hover:text-white hover:bg-white/10 text-lg leading-none"
              title="Cancel"
              aria-label="Cancel"
              onClick={() => dismissSpanPopover()}
            >
              ✕
            </button>
          </div>
          {spanPopover.mode === 'band' && (
            <div className="flex items-center mb-2">
              <ColorPicker
                value={spanPopover.selectedColor}
                onChange={(color) => setSpanPopover((p) => (p ? { ...p, selectedColor: color } : p))}
                size="sm"
              />
            </div>
          )}
          <button
            type="button"
            className="w-full py-2 rounded bg-[#F97316] text-black text-[10px] font-black uppercase"
            onClick={() => void saveSpanPopover()}
          >
            {spanPopover.isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      )}

      {/* ── Number 1–10 floating popover — issue #4 ────────────────────── */}
      {numPopover && (
        <div
          className="fixed z-[70] bg-[#2a2a2c] border border-white/10 rounded-lg shadow-2xl p-2"
          style={{ top: numPopover.y, left: numPopover.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-5 gap-1 mb-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
              const st = numberCellStyle(n);
              const isCurrent = numPopover.current === n;
              return (
                <button
                  key={n}
                  type="button"
                  className="w-7 h-7 rounded text-[10px] font-black transition-transform hover:scale-110 active:scale-95"
                  style={{
                    background: st.bg,
                    color: st.text,
                    outline: isCurrent ? '2px solid #F97316' : 'none',
                    outlineOffset: 2,
                  }}
                  onClick={() => {
                    patchCell(numPopover.rowId, numPopover.monday, {
                      ...(cells.find(
                        (c) => c.row_id === numPopover.rowId && c.cell_date === numPopover.monday
                      ) ?? {}),
                      row_id: numPopover.rowId,
                      cell_date: numPopover.monday,
                      value_number: n,
                    });
                    setNumPopover(null);
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
          {numPopover.current != null && (
            <button
              type="button"
              className="w-full text-[9px] text-gray-500 hover:text-red-400 text-center py-0.5"
              onClick={() => {
                patchCell(numPopover.rowId, numPopover.monday, null);
                setNumPopover(null);
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── Add row: type + name (defaults to Planning; drag row to change group) ─ */}
      {addRowModal && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddRowModal(null);
            e.stopPropagation();
          }}
        >
          <div
            className="bg-[#2a2a2c] border border-white/10 rounded-lg p-4 w-full max-w-md space-y-4"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-bold text-white">New row</p>
            <p className="text-[10px] text-gray-500">
              {addRowModal.insertCtx ? (
                <>
                  Row will be created in <span className="text-gray-400">{addRowModal.group}</span>{' '}
                  next to the selected row.
                </>
              ) : (
                <>
                  New rows start in <span className="text-gray-400">Planning</span> — drag the row to
                  another section if needed.
                </>
              )}
            </p>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {ROW_TYPE_OPTIONS.map((opt) => {
                const selected = addRowModal.rowType === opt.row_type;
                return (
                  <button
                    key={opt.row_type}
                    type="button"
                    className={`w-full text-left rounded-lg border px-3 py-2 ${
                      selected ? 'border-[#F97316] bg-white/5' : 'border-white/10 hover:bg-white/5'
                    }`}
                    onClick={() =>
                      setAddRowModal((m) => (m ? { ...m, rowType: opt.row_type } : m))
                    }
                  >
                    <span className="text-[11px] font-bold text-white">{opt.title}</span>
                    <span className="block text-[10px] text-gray-500 mt-0.5">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
            <input
              placeholder="Row name…"
              value={addRowModal.name ?? ''}
              onChange={(e) => setAddRowModal((m) => (m ? { ...m, name: e.target.value } : m))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void completeAddRow();
                }
              }}
              className="w-full bg-[#1C1C1E] border border-white/10 rounded px-2 py-2 text-sm"
            />
            <div className="flex gap-2 flex-wrap items-center">
              <button
                type="button"
                className="flex-1 min-w-[120px] py-2 rounded bg-[#F97316] text-black text-[10px] font-black uppercase"
                onClick={() => void completeAddRow()}
              >
                CREATE ROW
              </button>
              <button
                type="button"
                className="text-[10px] text-gray-500 px-2"
                onClick={() => setAddRowModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Band cell right-click → delete — issue #2 ───────────────────── */}
      {bandCtxMenu && (
        <ul
          className="fixed z-[80] bg-[#2a2a2c] border border-white/10 rounded-lg py-1 min-w-[140px] text-xs shadow-xl"
          style={{ left: bandCtxMenu.x, top: bandCtxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <li>
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-white/5"
              onClick={() => {
                setSpanPopover({
                  rowId: bandCtxMenu.rowId,
                  anchorWeekIndex: 0,
                  startIso: bandCtxMenu.cell.cell_date,
                  endIso: bandCtxMenu.cell.span_end_date || bandCtxMenu.cell.cell_date,
                  mode: bandCtxMenu.mode || 'band',
                  name: bandCtxMenu.cell.value_text || '',
                  selectedColor:
                    bandCtxMenu.cell.value_color ||
                    bandCtxMenu.cell.color ||
                    '#3b82f6',
                  anchorRect: {
                    left: bandCtxMenu.x,
                    bottom: bandCtxMenu.y + 8,
                    width: 48,
                  },
                  isEdit: true,
                  existingCellId: bandCtxMenu.cell.id,
                });
                setBandCtxMenu(null);
              }}
            >
              Edit
            </button>
          </li>
          <li>
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-red-400 hover:bg-white/5"
              onClick={async () => {
                const { cell, rowId } = bandCtxMenu;
                setBandCtxMenu(null);
                if (cell?.id) {
                  await deletePlanCellById(cell.id);
                } else if (cell?.cell_date) {
                  patchCell(rowId, cell.cell_date, null);
                }
              }}
            >
              Delete
            </button>
          </li>
        </ul>
      )}

      {/* ── Row label right-click context menu ──────────────────────────── */}
      {ctxMenu && (
        <ul
          className="fixed z-[80] bg-[#2a2a2c] border border-white/10 rounded-lg py-1 min-w-[160px] text-xs shadow-xl"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {['Edit row label…', 'Clear row cells', 'Insert row above', 'Insert row below', 'Delete row'].map(
            (label) => (
              <li key={label}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 hover:bg-white/5 ${
                    label === 'Delete row' ? 'text-red-400' : ''
                  }`}
                  onClick={async () => {
                    const row = ctxMenu.row;
                    setCtxMenu(null);
                    if (label === 'Delete row') {
                      if (window.confirm('Delete this row?')) await deletePlanRow(row.id);
                    }
                    if (label === 'Insert row above' || label === 'Insert row below') {
                      setAddRowModal({
                        group: row.row_group,
                        rowType: undefined,
                        name: '',
                        insertCtx: {
                          anchorRow: row,
                          position: label === 'Insert row below' ? 'below' : 'above',
                        },
                      });
                    }
                    if (label === 'Clear row cells') {
                      const rowCells = cells.filter((x) => x.row_id === row.id);
                      for (const c of rowCells) {
                        if (c?.id) await deletePlanCellById(c.id);
                      }
                    }
                    if (label === 'Edit row label…') {
                      setEditingRowLabel({ rowId: row.id, value: row.label });
                    }
                  }}
                >
                  {label}
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

