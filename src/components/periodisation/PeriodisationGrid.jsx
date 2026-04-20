import { useRef } from 'react';
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
import { getGroupHeaderDisplay } from './gridUtils';
import CellRenderer from './CellRenderer';
import { rowUsesSpanInteraction } from './cellUtils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function PeriodisationGrid({
  weeks,
  pxPerWeek,
  gridWidth,
  totalWidth,
  LEFT_COL,
  monthSpans,
  ROW_GROUPS,
  rowsByGroup,
  collapsed,
  setCollapsed,
  editingGroupHeader,
  setEditingGroupHeader,
  updateDisplayLabelForGroup,
  canEdit,
  dragRowId,
  dragOverRowId,
  handleRowDragStart,
  handleRowDragOver,
  handleRowDrop,
  handleRowDragEnd,
  editingRowLabel,
  setEditingRowLabel,
  updatePlanRow,
  ghostOpacity,
  showTeamPlan,
  viewMode,
  rows,
  ghostRowByKey,
  ghostCellMap,
  ghostCells,
  acwrSeries,
  effectiveCells,
  patches,
  resizingCell,
  spanSelection,
  onSpanPointerDown,
  onSpanPointerEnter,
  patchCell,
  onResizeMouseDown,
  setBandCtxMenu,
  setNumPopover,
  setCtxMenu,
  onHeaderClick,
  chartOpen,
  setChartOpen,
  chartData,
  chartOptions,
  crossGroupDrop,
}) {
  const scrollRef = useRef(null);

  return (
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
                            <div className="relative w-full h-full"
                                 style={{ opacity: ghostOpacity }}>
                              {showTeamPlan !== 'off' && viewMode === 'athlete' && rows.length > 0 && (() => {
                                const ghostRowMatch = ghostRowByKey[row.row_key || row.label];
                                if (!ghostRowMatch) return null;
                                const ghostKey = `${ghostRowMatch.id}|${w.monday}`;
                                const ghostCell = ghostCellMap[ghostKey];
                                if (!ghostCell) return null;
                                return (
                                  <div
                                    className="absolute inset-0 pointer-events-none"
                                    style={{
                                      opacity: showTeamPlan === 'ghost' ? 0.1 : 0.25,
                                      zIndex: 1,
                                    }}
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
                                      onResizeMouseDown={() => {}}
                                      resizingCell={null}
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
                                  onResizeMouseDown={onResizeMouseDown}
                                  resizingCell={resizingCell}
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
  );
}
