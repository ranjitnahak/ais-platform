export function compositeKey(rowId, monday) {
  return `${rowId}|${monday}`;
}

export function getCellForWeek(rowId, monday, cells, patches) {
  const k = compositeKey(rowId, monday);
  if (Object.prototype.hasOwnProperty.call(patches, k)) {
    const p = patches[k];
    if (p === null) return null;
    return p;
  }
  return cells.find((c) => c.row_id === rowId && c.cell_date === monday) ?? null;
}

/** Band / focus-span rows store one cell at `cell_date` with `span_end_date`; resolve cover for any week column. */
export function findSpanningCell(rowId, monday, cells, patches) {
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

export function rowUsesSpanInteraction(row) {
  return row?.row_type === 'band' || row?.row_type === 'text';
}

export function cellDisplayColor(cell, fallback = '#3b82f6') {
  return cell?.value_color || cell?.color || fallback;
}
