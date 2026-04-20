import { findSpanningCell, getCellForWeek, rowUsesSpanInteraction, cellDisplayColor } from './cellUtils';
import { rowMetricKey, acwrStyle, numberCellStyle, peakingStyle } from '../../lib/periodisationUtils';

const FOCUS_SPAN_DEFAULT_COLOR = '#6b7280';
const SPAN_SELECTION_HIGHLIGHT = 'rgba(249, 115, 22, 0.4)';

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
  onResizeMouseDown,
  resizingCell,
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
          {(() => {
            const isResizing = resizingCell?.cellId === cell.id;
            const previewStart = isResizing ? resizingCell.previewStart : cell.cell_date;
            const previewEnd = isResizing ? resizingCell.previewEnd : (cell.span_end_date || cell.cell_date);
            const previewSpanWeeks = weeks.filter(
              (w) => w.monday >= previewStart && w.monday <= previewEnd
            ).length;
            const previewPillWidth = previewSpanWeeks * pxPerWeek - 4;

            return (
              <div
                style={{
                  position: 'absolute',
                  left: (() => {
                    const isResizing = resizingCell?.cellId === cell.id;
                    if (!isResizing) return 2;
                    const origStartIdx = weeks.findIndex((w) => w.monday === cell.cell_date);
                    const previewStartIdx = weeks.findIndex((w) => w.monday === resizingCell.previewStart);
                    return 2 + (previewStartIdx - origStartIdx) * pxPerWeek;
                  })(),
                  top: 2,
                  width: previewPillWidth,
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
                  overflow: 'visible',
                  whiteSpace: 'nowrap',
                  paddingLeft: 8,
                  paddingRight: 8,
                  userSelect: 'none',
                }}
                title={cell.value_text}
              >
                {canEdit && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 8,
                      cursor: 'ew-resize',
                      borderRadius: '4px 0 0 4px',
                      background: 'rgba(0,0,0,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseDown={(e) => onResizeMouseDown(e, cell, 'left')}
                  >
                    <div style={{
                      width: 2, height: 10,
                      background: 'rgba(255,255,255,0.5)',
                      borderRadius: 1,
                    }} />
                  </div>
                )}
                <span style={{ paddingLeft: 6, paddingRight: 6 }}>
                  {cell.value_text}
                </span>
              </div>
            );
          })()}
        </div>
      );
    }

    if (monday > cell.cell_date && monday <= end) {
      const isLastWeek = monday === end;
      const isResizing = resizingCell?.cellId === cell.id;
      const previewEnd = isResizing
        ? resizingCell.previewEnd
        : (cell.span_end_date || cell.cell_date);
      const isPreviewLastWeek = monday === previewEnd;

      return (
        <div
          className="w-full h-full min-h-[22px] relative"
          data-span-cell={`${row.id}::${weekIndex}`}
          style={{ background: 'transparent' }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={bandContextMenu}
        >
          {canEdit && (isResizing ? isPreviewLastWeek : isLastWeek) && (
            <div
              style={{
                position: 'absolute',
                right: 2,
                top: 2,
                bottom: 2,
                width: 8,
                cursor: 'ew-resize',
                borderRadius: '0 4px 4px 0',
                background: 'rgba(0,0,0,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
              }}
              onMouseDown={(e) => onResizeMouseDown(e, cell, 'right')}
            >
              <div style={{
                width: 2, height: 10,
                background: 'rgba(255,255,255,0.6)',
                borderRadius: 1,
              }} />
            </div>
          )}
        </div>
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

export default CellRenderer;
