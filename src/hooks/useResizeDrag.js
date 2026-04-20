import { useCallback, useRef, useState } from 'react';

export default function useResizeDrag({ canEdit, pxPerWeek, weeks, patchCell }) {
  const resizeDragRef = useRef(null);
  const [resizingCell, setResizingCell] = useState(null);

  const onResizeMouseDown = useCallback((e, cell, edge) => {
    if (!canEdit) return;
    e.stopPropagation();
    e.preventDefault();
    resizeDragRef.current = {
      cell,
      rowId: cell.row_id,
      edge,
      startX: e.clientX,
      origStart: cell.cell_date,
      origEnd: cell.span_end_date || cell.cell_date,
    };
    setResizingCell({
      cellId: cell.id,
      previewStart: cell.cell_date,
      previewEnd: cell.span_end_date || cell.cell_date,
    });

    function onMouseMove(ev) {
      const d = resizeDragRef.current;
      if (!d) return;
      const deltaX = ev.clientX - d.startX;
      const deltaWeeks = Math.round(deltaX / pxPerWeek);
      if (deltaWeeks === 0) return;

      const origStartIdx = weeks.findIndex((w) => w.monday === d.origStart);
      const origEndIdx = weeks.findIndex((w) => w.monday === d.origEnd);
      if (origStartIdx === -1 || origEndIdx === -1) return;

      let newStartIdx = origStartIdx;
      let newEndIdx = origEndIdx;

      if (d.edge === 'right') {
        newEndIdx = Math.max(origStartIdx, origEndIdx + deltaWeeks);
        newEndIdx = Math.min(newEndIdx, weeks.length - 1);
      } else {
        newStartIdx = Math.min(origEndIdx, origStartIdx + deltaWeeks);
        newStartIdx = Math.max(0, newStartIdx);
      }

      if (newEndIdx - newStartIdx < 0) {
        if (d.edge === 'right') newEndIdx = newStartIdx;
        else newStartIdx = newEndIdx;
      }

      setResizingCell({
        cellId: d.cell.id,
        previewStart: weeks[newStartIdx].monday,
        previewEnd: weeks[newEndIdx].monday,
      });
    }

    async function onMouseUp(ev) {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      const d = resizeDragRef.current;
      resizeDragRef.current = null;
      if (!d) { setResizingCell(null); return; }

      const deltaX = ev.clientX - d.startX;
      const deltaWeeks = Math.round(deltaX / pxPerWeek);
      if (deltaWeeks === 0) { setResizingCell(null); return; }

      const origStartIdx = weeks.findIndex((w) => w.monday === d.origStart);
      const origEndIdx = weeks.findIndex((w) => w.monday === d.origEnd);
      if (origStartIdx === -1 || origEndIdx === -1) {
        setResizingCell(null);
        return;
      }

      let newStartIdx = origStartIdx;
      let newEndIdx = origEndIdx;

      if (d.edge === 'right') {
        newEndIdx = Math.max(origStartIdx, origEndIdx + deltaWeeks);
        newEndIdx = Math.min(newEndIdx, weeks.length - 1);
      } else {
        newStartIdx = Math.min(origEndIdx, origStartIdx + deltaWeeks);
        newStartIdx = Math.max(0, newStartIdx);
      }

      if (newEndIdx - newStartIdx < 0) {
        if (d.edge === 'right') newEndIdx = newStartIdx;
        else newStartIdx = newEndIdx;
      }

      const newStart = weeks[newStartIdx].monday;
      const newEnd = weeks[newEndIdx].monday;

      setResizingCell(null);

      patchCell(d.cell.row_id, d.origStart, {
        ...d.cell,
        id: d.cell.id,
        cell_date: newStart,
        span_end_date: newEnd,
      });
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [canEdit, pxPerWeek, weeks, patchCell]);

  return { resizingCell, onResizeMouseDown };
}
