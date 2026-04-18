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
import { supabase } from '../../lib/supabaseClient';
import { getCurrentUser } from '../../lib/auth';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const LEFT_COL = 140;
const ZOOMS = ['4Y', '1Y', '6M', '1M', '1W'];

const BAND_PRESET_COLORS = [
  { label: 'Blue',   value: '#3b82f6' },
  { label: 'Green',  value: '#22c55e' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Red',    value: '#ef4444' },
  { label: 'Purple', value: '#a855f7' },
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

/** Band rows store one cell at `cell_date` with `span_end_date`; resolve cover for any week column. */
function findBandCell(rowId, monday, cells, patches) {
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

async function deletePlanCellById(id) {
  const user = getCurrentUser();
  await supabase.from('plan_cells').delete().eq('id', id).eq('org_id', user.orgId);
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
  insertPlanRow,
  deletePlanRow,
  updatePlanRow,
  reorderPlanRows,
  onWeekSelect,
  fetchPlan,
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
  const [bandCtxMenu, setBandCtxMenu] = useState(null); // band cell right-click
  const [bandPopover, setBandPopover] = useState(null); // band create: { rowId, startIso, endIso, selectedColor }
  const [dragBand, setDragBand] = useState(null);     // band span drag: { rowId, startIdx, endIdx }
  const [editing, setEditing] = useState(null);       // text cell modal: { rowId, monday, initial }
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

  const rowsByGroup = useMemo(() => {
    const m = {};
    for (const g of ROW_GROUPS) m[g] = [];
    for (const r of rows) {
      const g = ROW_GROUPS.includes(r.row_group) ? r.row_group : 'Planning';
      if (!m[g]) m[g] = [];
      m[g].push(r);
    }
    return m;
  }, [rows]);

  const volumeRow = rows.find((r) => rowMetricKey(r) === 'volume');
  const intensityRow = rows.find((r) => rowMetricKey(r) === 'intensity');

  const weeklyLoads = useMemo(() => {
    return weeks.map((w) => {
      const v = volumeRow ? getCellForWeek(volumeRow.id, w.monday, cells, patches)?.value_number : null;
      const i = intensityRow ? getCellForWeek(intensityRow.id, w.monday, cells, patches)?.value_number : null;
      if (v == null && i == null) return null;
      return ((Number(v) || 0) + (Number(i) || 0)) / 2;
    });
  }, [weeks, volumeRow, intensityRow, cells, patches]);

  const acwrSeries = useMemo(() => computeAcwrSeries(weeklyLoads), [weeklyLoads]);

  const chartData = useMemo(() => {
    const vol = weeks.map((w) =>
      volumeRow ? getCellForWeek(volumeRow.id, w.monday, cells, patches)?.value_number ?? null : null
    );
    const ints = weeks.map((w) =>
      intensityRow ? getCellForWeek(intensityRow.id, w.monday, cells, patches)?.value_number ?? null : null
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
  }, [weeks, volumeRow, intensityRow, cells, patches, acwrSeries]);

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
    await fetchPlan?.();
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
    if (!srcRow || srcRow.row_group !== targetRow.row_group) return;

    const groupRows = rows
      .filter((r) => r.row_group === srcRow.row_group)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const fromIdx = groupRows.findIndex((r) => r.id === srcId);
    const toIdx = groupRows.findIndex((r) => r.id === targetRow.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...groupRows];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    await reorderPlanRows?.(reordered.map((r) => r.id));
    await fetchPlan?.();
  };

  const handleRowDragEnd = () => {
    setDragRowId(null);
    setDragOverRowId(null);
    dragRowIdRef.current = null;
  };

  // ── Close all floating UI on outer click ────────────────────────────────
  const closeAll = () => {
    setCtxMenu(null);
    setBandCtxMenu(null);
    setNumPopover(null);
  };

  const planDateRange =
    plan?.start_date && plan?.end_date
      ? `${formatPlanDate(plan.start_date)} — ${formatPlanDate(plan.end_date)}`
      : '';

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
          onClick={async () => {
            const newRow = await insertPlanRow({
              row_group: ROW_GROUPS[0],
              label: 'New row',
              row_type: 'text',
              sort_order: rows.length,
            });
            await fetchPlan?.();
            // Auto-focus the new row label for inline editing — issue #3
            if (newRow?.id) setEditingRowLabel({ rowId: newRow.id, value: 'New row' });
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
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [groupName]: !c[groupName] }))}
                  className="w-full flex items-center gap-2 px-2 py-1.5 bg-[#2d2d30] text-left text-[11px] font-bold text-gray-200 sticky left-0"
                >
                  <span className="text-gray-500">{isCollapsed ? '▸' : '▾'}</span>
                  {groupName}
                </button>

                {!isCollapsed &&
                  groupRows.map((row) => {
                    const isDragTarget = dragOverRowId === row.id && dragRowId !== row.id;
                    const isDragging = dragRowId === row.id;
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
                                  await fetchPlan?.();
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
                        </div>

                        {/* Cell area */}
                        <div className="flex" style={{ width: gridWidth }}>
                          {weeks.map((w, wi) => (
                            <div
                              key={w.monday}
                              className="border-r border-white/5 shrink-0 flex items-center justify-center p-0.5"
                              style={{ width: pxPerWeek, fontSize: 10 }}
                            >
                              <CellRenderer
                                row={row}
                                monday={w.monday}
                                weekIndex={wi}
                                weeks={weeks}
                                cells={cells}
                                patches={patches}
                                acwrSeries={acwrSeries}
                                canEdit={canEdit}
                                patchCell={patchCell}
                                setEditing={setEditing}
                                dragBand={dragBand}
                                setDragBand={setDragBand}
                                setBandPopover={setBandPopover}
                                setNumPopover={setNumPopover}
                                onBandRightClick={(x, y, cell) =>
                                  setBandCtxMenu({ x, y, cell, rowId: row.id })
                                }
                              />
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

      {/* ── Text cell edit modal ────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <form
            className="bg-[#2a2a2c] border border-white/10 rounded-lg p-4 w-full max-w-xs space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = new FormData(e.target).get('val');
              patchCell(editing.rowId, editing.monday, {
                ...(cells.find(
                  (c) => c.row_id === editing.rowId && c.cell_date === editing.monday
                ) ?? {}),
                row_id: editing.rowId,
                cell_date: editing.monday,
                value_text: String(v),
              });
              setEditing(null);
            }}
          >
            <p className="text-xs font-bold text-white">Edit cell</p>
            <input
              name="val"
              defaultValue={editing.initial}
              autoFocus
              className="w-full bg-[#1C1C1E] border border-white/10 rounded px-2 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2 rounded bg-[#F97316] text-black text-[10px] font-black uppercase"
              >
                OK
              </button>
              <button
                type="button"
                className="flex-1 py-2 rounded border border-white/10 text-[10px]"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </form>
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

      {/* ── Band creation popover — 6 preset colors — issue #2 ─────────── */}
      {bandPopover && canEdit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <form
            className="bg-[#2a2a2c] border border-white/10 rounded-lg p-4 w-full max-w-xs space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const label = new FormData(e.target).get('label');
              patchCell(bandPopover.rowId, bandPopover.startIso, {
                row_id: bandPopover.rowId,
                cell_date: bandPopover.startIso,
                span_end_date: bandPopover.endIso,
                value_text: String(label || ''),
                color: bandPopover.selectedColor ?? BAND_PRESET_COLORS[0].value,
              });
              setBandPopover(null);
            }}
          >
            <p className="text-xs font-bold text-white">New band</p>
            <input
              name="label"
              placeholder="Band name…"
              autoFocus
              required
              className="w-full bg-[#1C1C1E] border border-white/10 rounded px-2 py-2 text-sm"
            />
            <div>
              <p className="text-[10px] text-gray-500 mb-2">Color</p>
              <div className="flex gap-2.5">
                {BAND_PRESET_COLORS.map((c) => {
                  const selected =
                    (bandPopover.selectedColor ?? BAND_PRESET_COLORS[0].value) === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                      style={{
                        background: c.value,
                        outline: selected ? '2px solid #F97316' : '2px solid transparent',
                        outlineOffset: 2,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setBandPopover((prev) => ({ ...prev, selectedColor: c.value }));
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2 rounded bg-[#F97316] text-black text-[10px] font-black uppercase"
              >
                Save
              </button>
              <button
                type="button"
                className="flex-1 py-2 rounded border border-white/10 text-[10px]"
                onClick={() => setBandPopover(null)}
              >
                Cancel
              </button>
            </div>
          </form>
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
              className="w-full text-left px-3 py-2 text-red-400 hover:bg-white/5"
              onClick={async () => {
                const { cell, rowId } = bandCtxMenu;
                setBandCtxMenu(null);
                if (cell?.id) {
                  await deletePlanCellById(cell.id);
                  await fetchPlan?.();
                } else if (cell?.cell_date) {
                  patchCell(rowId, cell.cell_date, null);
                }
              }}
            >
              Delete band
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
                      await fetchPlan?.();
                    }
                    if (label === 'Insert row above' || label === 'Insert row below') {
                      const order = row.sort_order ?? 0;
                      const target = order + (label === 'Insert row below' ? 1 : 0);
                      for (const r of rows
                        .filter((x) => (x.sort_order ?? 0) >= target)
                        .sort((a, b) => (b.sort_order ?? 0) - (a.sort_order ?? 0))) {
                        await updatePlanRow(r.id, { sort_order: (r.sort_order ?? 0) + 1 });
                      }
                      const newRow = await insertPlanRow({
                        row_group: row.row_group,
                        label: 'New row',
                        row_type: 'text',
                        sort_order: target,
                      });
                      await fetchPlan?.();
                      if (newRow?.id) setEditingRowLabel({ rowId: newRow.id, value: 'New row' });
                    }
                    if (label === 'Clear row cells') {
                      for (const w of weeks) {
                        const c = cells.find((x) => x.row_id === row.id && x.cell_date === w.monday);
                        if (c?.id) await deletePlanCellById(c.id);
                      }
                      await fetchPlan?.();
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
  cells,
  patches,
  acwrSeries,
  canEdit,
  patchCell,
  setEditing,
  dragBand,
  setDragBand,
  setBandPopover,
  setNumPopover,
  onBandRightClick,
}) {
  const cell =
    row.row_type === 'band'
      ? findBandCell(row.id, monday, cells, patches)
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

  if (row.row_type === 'text') {
    const t = cell?.value_text ?? '';
    const prev =
      weekIndex > 0
        ? getCellForWeek(row.id, weeks[weekIndex - 1].monday, cells, patches)?.value_text
        : null;
    if (t && prev === t) return <div className="w-full h-full bg-[#2a2a2c]" />;
    return (
      <button
        type="button"
        disabled={!canEdit}
        className="w-full h-full min-h-[22px] rounded bg-[#2a2a2c] text-[9px] text-gray-200 px-0.5 truncate border border-white/5"
        onDoubleClick={() => canEdit && setEditing({ rowId: row.id, monday, initial: t })}
        title={t}
      >
        {t || '—'}
      </button>
    );
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

  // ── Band row — drag to span + right-click delete — issue #2 ────────────
  if (row.row_type === 'band') {
    const dragActive = dragBand?.rowId === row.id;
    const inDragRange =
      dragActive &&
      weekIndex >= Math.min(dragBand.startIdx, dragBand.endIdx ?? dragBand.startIdx) &&
      weekIndex <= Math.max(dragBand.startIdx, dragBand.endIdx ?? dragBand.startIdx);

    if (!cell?.value_text || !cell.cell_date) {
      return (
        <button
          type="button"
          disabled={!canEdit}
          className={`w-full h-full min-h-[22px] rounded ${
            inDragRange
              ? 'bg-blue-500/30 border border-blue-400/50'
              : 'bg-white/5 hover:bg-white/10'
          }`}
          onMouseDown={() =>
            canEdit && setDragBand({ rowId: row.id, startIdx: weekIndex, endIdx: weekIndex })
          }
          onMouseEnter={() => {
            if (!dragBand || dragBand.rowId !== row.id) return;
            setDragBand((d) => (d ? { ...d, endIdx: weekIndex } : d));
          }}
          onMouseUp={() => {
            if (!dragBand || dragBand.rowId !== row.id) return;
            const a = Math.min(dragBand.startIdx, dragBand.endIdx ?? dragBand.startIdx);
            const b = Math.max(dragBand.startIdx, dragBand.endIdx ?? dragBand.startIdx);
            setBandPopover({
              rowId: row.id,
              startIso: weeks[a].monday,
              endIso: weeks[b].monday,
              selectedColor: BAND_PRESET_COLORS[0].value,
            });
            setDragBand(null);
          }}
        />
      );
    }

    const start = cell.cell_date;
    const end = cell.span_end_date || cell.cell_date;
    const isFirst = monday === start;
    return (
      <div
        className={`w-full h-5 flex items-center justify-center text-[9px] font-bold truncate px-0.5 ${
          isFirst ? 'rounded-l' : ''
        } ${monday === end ? 'rounded-r' : ''}`}
        style={{ background: cell.color || '#3b82f6', color: '#0f172a' }}
        title={cell.value_text}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onBandRightClick(e.clientX, e.clientY, cell);
        }}
      >
        {isFirst ? cell.value_text : ''}
      </div>
    );
  }

  return <span className="text-gray-600">—</span>;
}
