import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  weekStartsBetween,
  addDays,
  rowMetricKey,
  computeAcwrSeries,
  acwrStyle,
  numberCellStyle,
  peakingStyle,
  ROW_GROUPS,
  ZOOM_PX,
} from '../../lib/periodisationUtils';
import ColorPicker from '../ui/ColorPicker';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const LEFT_COL = 140;
const ZOOMS = ['4Y', '1Y', '6M', '1M', '1W'];

const BAND_PRESET_COLORS = [
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Purple', value: '#8b5cf6' },
];

const FOCUS_SPAN_DEFAULT_COLOR = '#6b7280';
/** Orange highlight for active span selection (drag or popover open), 40% opacity */
const SPAN_SELECTION_HIGHLIGHT = 'rgba(249, 115, 22, 0.4)';

function rowUsesSpanInteraction(row) {
  return row?.row_type === 'band' || row?.row_type === 'text';
}

function cellDisplayColor(cell, fallback = '#3b82f6') {
  return cell?.value_color || cell?.color || fallback;
}

/** Human-readable title when `display_label` is unset (handles snake_case keys). */
function formatRowGroupForDisplay(rowGroup) {
  if (!rowGroup) return '';
  const g = String(rowGroup);
  if (ROW_GROUPS.includes(g)) return g;
  return g
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function getGroupHeaderDisplay(groupCanonical, groupRows) {
  const dl = groupRows.map((r) => r.display_label).find((x) => x != null && String(x).trim() !== '');
  if (dl) return String(dl).trim();
  return formatRowGroupForDisplay(groupCanonical);
}

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

function compositeKey(rowId, monday) {
  return `${rowId}|${monday}`;
}

function getCellForWeek(rowId, monday, cells, patches) {
  const k = compositeKey(rowId, monday);
  if (Object.prototype.hasOwnProperty.call(patches, k)) {
    const p = patches[k];
    if (p === null) return null;
    return p;
  }
  return cells.find((c) => c.row_id === rowId && c.cell_date === monday) ?? null;
}

/** Band / focus-span rows store one cell at `cell_date` with `span_end_date`; resolve cover for any week column. */
function findSpanningCell(rowId, monday, cells, patches) {
  for (const [key, val] of Object.entries(patches)) {
    if (!key.startsWith(`${rowId}|`) || val === null || !val?.value_text) continue;
    const end = val.span_end_date || val.cell_date;
    if (val.cell_date && monday >= val.cell_date && monday <= end) return val;
  }
  for (const c of cells) {
    if (c.row_id !== rowId || !c.value_text) continue;
    const end = c.span_end_date || c.cell_date;
    if (c.cell_date && monday >= c.cell_date && monday <= end) return c;
  }
  return null;
}

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
  showTeamPlan = true,
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
  const scrollRef = useRef(null);
  const patchesRef = useRef({});

  // Grid state
  const [collapsed, setCollapsed] = useState({});
  const [chartOpen, setChartOpen] = useState(true);
  const [patches, setPatches] = useState({});
  const [, setHistory] = useState([]);
  const [, setFuture] = useState([]);

  // Menus / popovers
  const [ctxMenu, setCtxMenu] = useState(null);       // row label right-click
  const [bandCtxMenu, setBandCtxMenu] = useState(null); // band / focus-span right-click
  /** dragStart–dragEnd in week indices; kept after    until Create / cancel / Escape */
  const [spanSelection, setSpanSelection] = useState(null);
  const [spanPopover, setSpanPopover] = useState(null); // inline create/edit for span rows
  const spanDragRef = useRef(null);
  const justFinishedDragRef = useRef(false);
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
    if (viewMode === 'athlete' && showTeamPlan && ghostRows.length > 0) {
      return ghostRows;
    }
    return rows;
  }, [rows, ghostRows, viewMode, showTeamPlan]);

  const effectiveCells = useMemo(() => {
    if (rows.length > 0) return cells;
    if (viewMode === 'athlete' && showTeamPlan && ghostRows.length > 0) {
      return ghostCells;
    }
    return cells;
  }, [rows, cells, ghostCells, ghostRows, viewMode, showTeamPlan]);

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
    if (!showTeamPlan || !ghostCells.length) return {};
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
      const { org_id: _o, id: _i, ...rest } = val;
      await upsertCell({ ...rest, row_id: rowId, cell_date: monday });
    }
    setPatches({});
    setHistory([]);
    setFuture([]);
  };

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

  const dismissSpanPopover = useCallback(() => {
    setSpanPopover(null);
    setSpanSelection(null);
    spanDragRef.current = null;
  }, []);

  const onSpanPointerDown = useCallback(
    (row, weekIndex, e) => {
      if (!canEdit || !rowUsesSpanInteraction(row)) return;
      e.preventDefault();
      e.stopPropagation();
      const mode = row.row_type === 'band' ? 'band' : 'text';
      spanDragRef.current = { rowId: row.id, startIdx: weekIndex, endIdx: weekIndex, mode };
      setSpanSelection({ rowId: row.id, startIdx: weekIndex, endIdx: weekIndex });
    },
    [canEdit]
  );

  const onSpanPointerEnter = useCallback((rowId, weekIndex) => {
    const d = spanDragRef.current;
    if (!d || d.rowId !== rowId) return;
    d.endIdx = weekIndex;
    setSpanSelection({ rowId, startIdx: d.startIdx, endIdx: weekIndex });
  }, []);

  useEffect(() => {
    const onWinMouseMove = (e) => {
      if (!spanDragRef.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      const cell =
        el.closest('[data-span-cell]') ||
        el.querySelector('[data-span-cell]') ||
        el.parentElement?.closest('[data-span-cell]');
      if (!cell) return;
      const raw = cell.getAttribute('data-span-cell');
      if (!raw) return;
      const [cellRowId, cellIdxStr] = raw.split('::');
      const cellIdx = parseInt(cellIdxStr, 10);
      if (Number.isNaN(cellIdx)) return;
      if (cellRowId === spanDragRef.current.rowId) {
        spanDragRef.current.endIdx = cellIdx;
        const { rowId, startIdx, endIdx } = spanDragRef.current;
        setSpanSelection({
          rowId,
          startIdx: Math.min(startIdx, endIdx),
          endIdx: Math.max(startIdx, endIdx),
        });
      }
    };

    const onWinMouseUp = (e) => {
      const d = spanDragRef.current;
      if (!d) return;
      const { rowId, startIdx, endIdx, mode } = d;
      const dragStart = Math.min(startIdx, endIdx);
      const dragEnd = Math.max(startIdx, endIdx);
      const wA = weeks[dragStart];
      const wB = weeks[dragEnd];
      if (!wA || !wB) {
        spanDragRef.current = null;
        setSpanSelection(null);
        return;
      }
      setSpanSelection({ rowId, startIdx: dragStart, endIdx: dragEnd });
      justFinishedDragRef.current = true;
      setTimeout(() => {
        justFinishedDragRef.current = false;
      }, 100);
      const anchorRect = {
        left: Math.min(e.clientX, window.innerWidth - 272),
        bottom: e.clientY + 8,
        width: 48,
      };
      setSpanPopover({
        rowId,
        anchorWeekIndex: dragEnd,
        startIso: wA.monday,
        endIso: wB.monday,
        mode,
        name: '',
        selectedColor: BAND_PRESET_COLORS[0].value,
        anchorRect,
      });
      spanDragRef.current = null;
    };
    window.addEventListener('mousemove', onWinMouseMove);
    window.addEventListener('mouseup', onWinMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWinMouseMove);
      window.removeEventListener('mouseup', onWinMouseUp);
    };
  }, [weeks]);

  useEffect(() => {
    const k = (e) => {
      if (e.key !== 'Escape') return;
      if (spanPopover) dismissSpanPopover();
      else if (spanDragRef.current) {
        spanDragRef.current = null;
        setSpanSelection(null);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [spanPopover, dismissSpanPopover]);

  const saveSpanPopover = async () => {
    if (!spanPopover) return;
    const label = spanPopover.name.trim();
    if (!label) return;
    const color =
      spanPopover.mode === 'text'
        ? FOCUS_SPAN_DEFAULT_COLOR
        : spanPopover.selectedColor ?? BAND_PRESET_COLORS[0].value;
    const payload = {
      row_id: spanPopover.rowId,
      cell_date: spanPopover.startIso,
      span_end_date: spanPopover.endIso,
      value_text: label,
      value_color: color,
      color,
    };
    if (spanPopover.isEdit) {
      payload.id = spanPopover.existingCellId;
    }
    await upsertCell(payload);
    dismissSpanPopover();
  };

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

      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 border border-white/10 rounded-lg bg-[#252528] p-3">
        <select
          value={selectedTeamId ?? ''}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          className="bg-[#1C1C1E] border border-white/10 rounded px-2 py-1.5 text-xs min-w-[160px]"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
          className="bg-[#1C1C1E] border border-white/10 rounded px-2 py-1.5 text-xs"
        >
          <option value="team">Team Plan</option>
          <option value="athlete">Individual Athlete</option>
        </select>
        {viewMode === 'athlete' && (
          <select
            value={selectedAthleteId ?? ''}
            onChange={(e) => setSelectedAthleteId(e.target.value || null)}
            className="bg-[#1C1C1E] border border-white/10 rounded px-2 py-1.5 text-xs min-w-[140px]"
          >
            <option value="">Select athlete…</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        )}
        {viewMode === 'athlete' && (
          <button
            type="button"
            onClick={() => setShowTeamPlan?.((v) => !v)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded
        text-[10px] font-bold uppercase border transition-colors
        ${
          showTeamPlan
            ? 'border-[#F97316] text-[#F97316] bg-[#F97316]/10'
            : 'border-white/10 text-gray-500 hover:text-white'
        }`}
          >
            <span className="material-symbols-outlined text-[12px]">
              {showTeamPlan ? 'visibility' : 'visibility_off'}
            </span>
            Team plan
          </button>
        )}
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {ZOOMS.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoomLevel(z)}
              className={`px-2 py-1.5 text-[10px] font-black uppercase ${
                zoomLevel === z ? 'bg-[#F97316] text-black' : 'bg-[#1C1C1E] text-gray-400 hover:text-white'
              }`}
            >
              {z}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          disabled={!canEdit}
          onClick={(e) => {
            e.stopPropagation();
            if (!canEdit) return;
            setAddRowModal({ group: 'Planning', rowType: undefined, name: '' });
          }}
          className="px-2 py-1.5 rounded border border-white/15 text-[10px] font-bold uppercase text-gray-300 hover:bg-white/5 disabled:opacity-40"
        >
          + Add row
        </button>
        <div className="relative group">
          <button
            type="button"
            className="px-2 py-1.5 rounded border border-white/15 text-[10px] font-bold uppercase text-gray-300 hover:bg-white/5"
          >
            Templates ▾
          </button>
          <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 bg-[#2a2a2c] border border-white/10 rounded-lg py-1 min-w-[180px] shadow-xl">
            {templates.length === 0 && (
              <div className="px-3 py-2 text-[10px] text-gray-500">No templates in DB</div>
            )}
            {templates.map((t) => (
              <div key={t.id} className="px-3 py-1.5 text-[10px] text-gray-400">
                {t.name}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={!canEdit || !Object.keys(patches).length}
          onClick={() => flushSave()}
          className="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase bg-[#F97316] text-black disabled:opacity-40"
        >
          Save
        </button>
      </div>

      <div ref={scrollRef} className="overflow-x-auto border border-white/10 rounded-lg bg-[#252528]">
        <div style={{ minWidth: totalWidth }} className="inline-block align-top">
          {/* Month + week headers */}
          <div className="flex border-b border-white/10">
            <div
              className="shrink-0 border-r border-white/20 bg-[#1C1C1E] sticky left-0 z-20 px-2 py-2 text-[10px] font-bold uppercase text-gray-500 flex items-end"
              style={{ width: LEFT_COL }}
            >
              Row / Period
            </div>
            <div className="flex flex-col flex-1" style={{ width: gridWidth }}>
              <div className="flex border-b border-white/5 h-7">
                {monthSpans.map((s, si) => (
                  <div
                    key={si}
                    className="text-center text-[10px] font-bold text-gray-400 border-r border-white/5 flex items-center justify-center"
                    style={{ width: s.cols * pxPerWeek }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
              <div className="flex h-8">
                {weeks.map((w, idx) => (
                  <button
                    key={w.monday}
                    type="button"
                    onClick={() => onHeaderClick(idx)}
                    className="border-r border-white/5 text-[10px] font-bold text-gray-300 hover:bg-[#F97316]/20 hover:text-white cursor-pointer shrink-0 flex items-center justify-center transition-colors"
                    style={{ width: pxPerWeek }}
                  >
                    W{idx + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Groups */}
          {ROW_GROUPS.map((groupName) => {
            const groupRows = rowsByGroup[groupName] ?? [];
            if (!groupRows.length) return null;
            const isCollapsed = collapsed[groupName];
            return (
              <div key={groupName} className="border-b border-white/10">
                <div className="w-full flex items-center gap-2 px-2 py-1.5 bg-[#2d2d30] text-left text-[11px] font-bold text-gray-200 sticky left-0">
                  <button
                    type="button"
                    className="text-gray-500 shrink-0 w-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsed((c) => ({ ...c, [groupName]: !c[groupName] }));
                    }}
                    aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
                  >
                    {isCollapsed ? '▸' : '▾'}
                  </button>
                  {editingGroupHeader?.groupKey === groupName ? (
                    <input
                      autoFocus
                      value={editingGroupHeader.value}
                      onChange={(e) =>
                        setEditingGroupHeader((h) => (h ? { ...h, value: e.target.value } : h))
                      }
                      onClick={(e) => e.stopPropagation()}
                      onBlur={async () => {
                        if (!editingGroupHeader || !updateDisplayLabelForGroup) {
                          setEditingGroupHeader(null);
                          return;
                        }
                        const v = editingGroupHeader.value.trim();
                        try {
                          await updateDisplayLabelForGroup(groupName, v || null);
                        } catch (err) {
                          console.error(err);
                        }
                        setEditingGroupHeader(null);
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Escape') {
                          setEditingGroupHeader(null);
                          return;
                        }
                        if (e.key !== 'Enter') return;
                        e.currentTarget.blur();
                      }}
                      className="flex-1 min-w-0 bg-[#1C1C1E] border border-[#F97316] rounded px-2 py-0.5 text-[11px] text-white outline-none"
                    />
                  ) : (
                    <span
                      className="flex-1 min-w-0 truncate cursor-default"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!canEdit || !updateDisplayLabelForGroup) return;
                        setEditingGroupHeader({
                          groupKey: groupName,
                          value: getGroupHeaderDisplay(groupName, groupRows),
                        });
                      }}
                      title={canEdit ? 'Double-click to edit section title' : undefined}
                    >
                      {getGroupHeaderDisplay(groupName, groupRows)}
                    </span>
                  )}
                </div>

                {!isCollapsed &&
                  groupRows.map((row) => {
                    const isDragTarget = dragOverRowId === row.id && dragRowId !== row.id;
                    const isDragging = dragRowId === row.id;
                    const showGroupDropHint = isDragTarget && crossGroupDrop;
                    return (
                      <div
                        key={row.id}
                        className="flex min-h-[28px]"
                        style={{
                          borderTop: isDragTarget ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.05)',
                          opacity: isDragging ? 0.4 : 1,
                          transition: 'opacity 0.15s',
                        }}
                        draggable={canEdit}
                        onDragStart={(e) => handleRowDragStart(e, row.id)}
                        onDragOver={(e) => handleRowDragOver(e, row.id)}
                        onDrop={(e) => handleRowDrop(e, row)}
                        onDragEnd={handleRowDragEnd}
                      >
                        {/* Frozen label cell */}
                        <div
                          className="shrink-0 sticky left-0 z-10 flex items-center gap-1 border-r border-white/20 bg-[#1C1C1E] px-1 py-0.5 text-[11px] text-gray-300"
                          style={{ width: LEFT_COL }}
                          onContextMenu={(e) => {
                            if (!canEdit) return;
                            e.preventDefault();
                            setCtxMenu({ x: e.clientX, y: e.clientY, row });
                          }}
                        >
                          <span className="text-gray-600 cursor-grab select-none shrink-0">⠿</span>
                          {/* Inline label edit — issue #3 */}
                          {editingRowLabel?.rowId === row.id ? (
                            <input
                              autoFocus
                              value={editingRowLabel.value}
                              onChange={(e) =>
                                setEditingRowLabel((l) => ({ ...l, value: e.target.value }))
                              }
                              onBlur={async () => {
                                const label = editingRowLabel.value.trim();
                                if (label && label !== row.label) {
                                  await updatePlanRow(row.id, { label });
                                }
                                setEditingRowLabel(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                                if (e.key === 'Escape') setEditingRowLabel(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 min-w-0 bg-transparent border-b border-[#F97316] text-[11px] text-white outline-none px-0"
                            />
                          ) : (
                            <span
                              className="truncate flex-1"
                              onDoubleClick={() =>
                                canEdit &&
                                setEditingRowLabel({ rowId: row.id, value: row.label })
                              }
                            >
                              {row.label}
                            </span>
                          )}
                          {showGroupDropHint && (
                            <span
                              className="shrink-0 text-[9px] font-bold text-[#F97316] max-w-[72px] truncate"
                              title={`Drop into ${row.row_group}`}
                            >
                              → {row.row_group}
                            </span>
                          )}
                        </div>

                        {/* Cell area */}
                        <div className="flex" style={{ width: gridWidth }}>
                          {weeks.map((w, wi) => (
                            <div
                              key={w.monday}
                              data-span-cell={`${row.id}::${wi}`}
                              className={`border-r border-white/5 shrink-0 flex items-center justify-center p-0.5 ${
                                rowUsesSpanInteraction(row) ? 'relative z-10 overflow-visible' : ''
                              }`}
                              style={{
                                width: pxPerWeek,
                                fontSize: 10,
                                ...(rowUsesSpanInteraction(row)
                                  ? { position: 'relative', overflow: 'visible' }
                                  : {}),
                              }}
                              onClick={
                                rowUsesSpanInteraction(row) ? (e) => e.stopPropagation() : undefined
                              }
                            >
                              <div className="relative w-full h-full">
                                {showTeamPlan && viewMode === 'athlete' && (() => {
                                  const ghostRowMatch = ghostRowByKey[row.row_key || row.label];
                                  if (!ghostRowMatch) return null;
                                  const ghostKey = `${ghostRowMatch.id}|${w.monday}`;
                                  const ghostCell = ghostCellMap[ghostKey];
                                  if (!ghostCell) return null;
                                  return (
                                    <div
                                      className="absolute inset-0 pointer-events-none"
                                      style={{ opacity: 0.25, zIndex: 1 }}
                                    >
                                      <CellRenderer
                                        row={{ ...ghostRowMatch, id: ghostRowMatch.id }}
                                        monday={w.monday}
                                        weekIndex={wi}
                                        weeks={weeks}
                                        pxPerWeek={pxPerWeek}
                                        cells={ghostCells}
                                        patches={{}}
                                        acwrSeries={acwrSeries}
                                        canEdit={false}
                                        patchCell={() => {}}
                                        spanSelection={null}
                                        onSpanPointerDown={() => {}}
                                        onSpanPointerEnter={() => {}}
                                        setNumPopover={() => {}}
                                        onBandRightClick={() => {}}
                                      />
                                    </div>
                                  );
                                })()}
                                <div className="relative" style={{ zIndex: 2 }}>
                                  <CellRenderer
                                    row={row}
                                    monday={w.monday}
                                    weekIndex={wi}
                                    weeks={weeks}
                                    pxPerWeek={pxPerWeek}
                                    cells={effectiveCells}
                                    patches={patches}
                                    acwrSeries={acwrSeries}
                                    canEdit={canEdit}
                                    patchCell={patchCell}
                                    spanSelection={spanSelection}
                                    onSpanPointerDown={onSpanPointerDown}
                                    onSpanPointerEnter={onSpanPointerEnter}
                                    setNumPopover={setNumPopover}
                                    onBandRightClick={(x, y, cell, rowType) =>
                                      setBandCtxMenu({ x, y, cell, rowId: row.id, mode: rowType })
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>

        {/* Load wave chart */}
        <div className="border-t border-white/10 bg-[#1C1C1E] sticky left-0">
          <div className="flex justify-between items-center px-3 py-2 border-b border-white/5">
            <span className="text-[10px] font-bold uppercase text-gray-500">Load wave</span>
            <button
              type="button"
              onClick={() => setChartOpen((o) => !o)}
              className="text-[10px] font-bold uppercase text-[#F97316]"
            >
              {chartOpen ? 'Collapse ▲' : 'Expand ▼'}
            </button>
          </div>
          {chartOpen && (
            <div className="px-2 pb-3" style={{ width: totalWidth, height: 200 }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          )}
        </div>
      </div>

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

// ── CellRenderer ─────────────────────────────────────────────────────────────

function CellRenderer({
  row,
  monday,
  weekIndex,
  weeks,
  pxPerWeek,
  cells,
  patches,
  acwrSeries,
  canEdit,
  patchCell,
  spanSelection,
  onSpanPointerDown,
  onSpanPointerEnter,
  setNumPopover,
  onBandRightClick,
}) {
  const cell = rowUsesSpanInteraction(row)
    ? findSpanningCell(row.id, monday, cells, patches)
    : getCellForWeek(row.id, monday, cells, patches);
  const rk = rowMetricKey(row);

  if (row.row_type === 'auto' && rk === 'acwr') {
    const r = acwrSeries[weekIndex];
    const st = acwrStyle(r);
    return (
      <span
        className="inline-flex min-w-[36px] justify-center rounded px-1 py-0.5 font-bold"
        style={{ background: st.bg, color: st.text }}
      >
        {r == null ? '—' : r.toFixed(2)}
      </span>
    );
  }

  if (row.row_type === 'auto') {
    const n = cell?.value_number;
    const st = rk === 'peaking_index' ? peakingStyle(n) : numberCellStyle(n);
    return (
      <span
        className="inline-flex min-w-[28px] justify-center rounded px-1 py-0.5 font-bold"
        style={{ background: st.bg, color: st.text }}
      >
        {n == null ? '—' : n}
      </span>
    );
  }

  // ── Number row — 1-10 click selector — issue #4 ────────────────────────
  if (row.row_type === 'number') {
    const n = cell?.value_number;
    const st = numberCellStyle(n);
    return (
      <button
        type="button"
        disabled={!canEdit}
        className="w-full h-full min-h-[22px] rounded font-bold text-[10px]"
        style={{ background: st.bg, color: st.text }}
        onClick={(e) => {
          if (!canEdit) return;
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setNumPopover({
            rowId: row.id,
            monday,
            current: n ?? null,
            x: Math.min(rect.left, window.innerWidth - 160),
            y: rect.bottom + 4,
          });
        }}
      >
        {n ?? '·'}
      </button>
    );
  }

  if (rowUsesSpanInteraction(row)) {
    const inSelectionRange =
      spanSelection?.rowId === row.id &&
      weekIndex >= Math.min(spanSelection.startIdx, spanSelection.endIdx) &&
      weekIndex <= Math.max(spanSelection.startIdx, spanSelection.endIdx);

    if (!cell?.value_text || !cell.cell_date) {
      return (
        <button
          type="button"
          disabled={!canEdit}
          data-span-cell={`${row.id}::${weekIndex}`}
          className="w-full h-full min-h-[22px] rounded border border-transparent"
          style={{
            background: inSelectionRange ? SPAN_SELECTION_HIGHLIGHT : 'rgba(255,255,255,0.05)',
          }}
          onMouseDown={(e) => onSpanPointerDown(row, weekIndex, e)}
          onMouseEnter={() => onSpanPointerEnter(row.id, weekIndex)}
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    const start = cell.cell_date;
    const end = cell.span_end_date || cell.cell_date;
    const isTextSpan = row.row_type === 'text';
    const bg = isTextSpan ? cellDisplayColor(cell, FOCUS_SPAN_DEFAULT_COLOR) : cellDisplayColor(cell);
    const fg = isTextSpan ? '#f9fafb' : '#0f172a';

    const spanWeeks = weeks.filter(
      (w) => w.monday >= cell.cell_date && w.monday <= (cell.span_end_date || cell.cell_date)
    ).length;
    const pillWidth = spanWeeks * pxPerWeek - 4;

    const bandContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      onBandRightClick(e.clientX, e.clientY, cell, row.row_type);
    };

    if (monday === cell.cell_date) {
      return (
        <div
          className="relative w-full h-full min-h-[22px]"
          data-span-cell={`${row.id}::${weekIndex}`}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={bandContextMenu}
        >
          <div
            style={{
              position: 'absolute',
              left: 2,
              top: 2,
              width: pillWidth,
              height: 'calc(100% - 4px)',
              background: bg,
              borderRadius: 4,
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 600,
              color: fg,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              paddingLeft: 8,
              paddingRight: 8,
            }}
            title={cell.value_text}
          >
            {cell.value_text}
          </div>
        </div>
      );
    }

    if (monday > cell.cell_date && monday <= end) {
      return (
        <div
          className="w-full h-full min-h-[22px]"
          data-span-cell={`${row.id}::${weekIndex}`}
          style={{ background: 'transparent' }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={bandContextMenu}
        />
      );
    }

    return null;
  }

  if (row.row_type === 'marker') {
    const on = !!(cell?.marker_type || cell?.value_number);
    const isTest = rk === 'testing' || (row.label || '').toLowerCase().includes('test');
    return (
      <button
        type="button"
        disabled={!canEdit}
        className="w-full h-full flex items-center justify-center"
        onClick={() => {
          if (!canEdit) return;
          if (on) patchCell(row.id, monday, null);
          else
            patchCell(row.id, monday, {
              ...cell,
              row_id: row.id,
              cell_date: monday,
              marker_type: isTest ? 'testing' : 'competition',
              value_number: 1,
            });
        }}
      >
        {on ? (
          isTest ? (
            <span className="w-2.5 h-2.5 bg-[#6366f1] rounded-sm" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
          )
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
        )}
      </button>
    );
  }

  if (row.row_type === 'toggle') {
    const on = cell?.value_number === 1 || cell?.value_text === 'on';
    return (
      <button
        type="button"
        disabled={!canEdit}
        className={`w-full h-full min-h-[22px] rounded ${on ? 'bg-emerald-600/40 text-white' : 'bg-transparent'}`}
        onClick={() => {
          if (!canEdit) return;
          patchCell(row.id, monday, {
            ...cell,
            row_id: row.id,
            cell_date: monday,
            value_number: on ? 0 : 1,
          });
        }}
      >
        {on ? 'ON' : ''}
      </button>
    );
  }

  return <span className="text-gray-600">—</span>;
}
