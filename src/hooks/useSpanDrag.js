import { useCallback, useEffect, useRef, useState } from 'react';

const BAND_PRESET_COLORS = [
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Purple', value: '#8b5cf6' },
];

const FOCUS_SPAN_DEFAULT_COLOR = '#6b7280';

function rowUsesSpanInteraction(row) {
  return row?.row_type === 'band' || row?.row_type === 'text';
}

export default function useSpanDrag({ canEdit, weeks, upsertCell, resizeDragRef }) {
  const spanDragRef = useRef(null);
  const justFinishedDragRef = useRef(false);
  const [spanSelection, setSpanSelection] = useState(null);
  const [spanPopover, setSpanPopover] = useState(null);

  const dismissSpanPopover = useCallback(() => {
    setSpanPopover(null);
    setSpanSelection(null);
    spanDragRef.current = null;
  }, []);

  const onSpanPointerDown = useCallback(
    (row, weekIndex, e) => {
      if (resizeDragRef.current) return;
      if (!canEdit || !rowUsesSpanInteraction(row)) return;
      e.preventDefault();
      e.stopPropagation();
      const mode = row.row_type === 'band' ? 'band' : 'text';
      spanDragRef.current = { rowId: row.id, startIdx: weekIndex, endIdx: weekIndex, mode };
      setSpanSelection({ rowId: row.id, startIdx: weekIndex, endIdx: weekIndex });
    },
    [canEdit, resizeDragRef]
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

  return {
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
  };
}
