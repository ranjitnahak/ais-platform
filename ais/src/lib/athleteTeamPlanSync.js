/**
 * Team ↔ individual periodisation sync helpers.
 * Used for "Replace with team plan" and "Update from team plan".
 */
import { weekStartsBetween } from './periodisationUtils';

const CELL_INSERT_CHUNK = 250;

/** Stable match key: row_key if set, else row_group + label. */
export function rowSyncKey(row) {
  const rk = (row.row_key || '').trim();
  if (rk) return `k:${rk}`;
  const g = (row.row_group || 'Planning').trim();
  const l = (row.label || '').trim();
  return `lbl:${g}::${l}`;
}

function rowUsesSpanningCells(row) {
  return row?.row_type === 'band' || row?.row_type === 'text';
}

function findExactCell(cells, rowId, monday) {
  return cells.find((c) => c.row_id === rowId && c.cell_date === monday) ?? null;
}

/** Any band/text cell on row whose interval overlaps [start, end] (ISO dates). */
function spanOverlapOnRow(cells, rowId, start, end) {
  for (const c of cells) {
    if (c.row_id !== rowId || !c.value_text || !c.cell_date) continue;
    const cs = c.cell_date;
    const ce = c.span_end_date || c.cell_date;
    if (cs <= end && ce >= start) return true;
  }
  return false;
}

function cellPayloadForInsert(orgId, rowId, src) {
  const out = {
    org_id: orgId,
    row_id: rowId,
    cell_date: src.cell_date,
    span_end_date: src.span_end_date ?? null,
    value_text: src.value_text ?? null,
    value_number: src.value_number ?? null,
    value_color: src.value_color ?? null,
    color: src.color ?? null,
    marker_type: src.marker_type ?? null,
  };
  return out;
}

async function insertCellsBatched(supabase, rows) {
  for (let i = 0; i < rows.length; i += CELL_INSERT_CHUNK) {
    const slice = rows.slice(i, i + CELL_INSERT_CHUNK);
    const { error } = await supabase.from('plan_cells').insert(slice);
    if (error) throw error;
  }
}

async function deletePlanRowsAndCells(supabase, orgId, planId, rowIds) {
  if (rowIds.length) {
    const { error: e1 } = await supabase.from('plan_cells').delete().eq('org_id', orgId).in('row_id', rowIds);
    if (e1) throw e1;
  }
  const { error: e2 } = await supabase.from('plan_rows').delete().eq('org_id', orgId).eq('plan_id', planId);
  if (e2) throw e2;
}

/**
 * Insert team rows onto athlete plan; returns inserted rows (with ids).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function insertRowsFromTeam(supabase, orgId, athletePlanId, teamRows) {
  const rowInserts = teamRows.map((r) => ({
    org_id: orgId,
    plan_id: athletePlanId,
    row_group: r.row_group,
    label: r.label,
    row_type: r.row_type,
    sort_order: r.sort_order,
    row_key: r.row_key ?? null,
    display_label: r.display_label ?? null,
  }));
  const { data, error } = await supabase.from('plan_rows').insert(rowInserts).select();
  if (error) throw error;
  return data || [];
}

function mapTeamRowIdsToInsertedAthleteRows(teamRows, insertedAthleteRows) {
  const insByKey = new Map(insertedAthleteRows.map((r) => [rowSyncKey(r), r.id]));
  const map = {};
  for (const tr of teamRows) {
    const nid = insByKey.get(rowSyncKey(tr));
    if (nid && tr.id) map[tr.id] = nid;
  }
  return map;
}

/**
 * Create athlete plan from team template when none exists.
 */
async function ensureAthletePlan(supabase, { orgId, teamId, athleteId, teamPlan }) {
  const { data: existing, error: exErr } = await supabase
    .from('periodisation_plans')
    .select('*')
    .eq('org_id', orgId)
    .eq('team_id', teamId)
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (exErr) throw exErr;
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('periodisation_plans')
    .insert({
      org_id: orgId,
      team_id: teamId,
      athlete_id: athleteId,
      name: teamPlan?.name ? `${teamPlan.name} (individual)` : 'Individual Plan',
      start_date: teamPlan.start_date,
      end_date: teamPlan.end_date,
    })
    .select()
    .single();
  if (error) throw error;
  return created;
}

/**
 * Replace athlete plan content with a full copy of the team plan (rows + cells).
 * Aligns plan dates and name with the team plan.
 */
export async function replaceAthleteWithTeamPlan(supabase, params) {
  const { orgId, teamId, athleteId, teamPlan, teamRows, teamCells } = params;
  if (!teamPlan?.id) throw new Error('No team plan to copy.');
  if (!teamRows?.length) throw new Error('Team plan has no rows.');

  let athletePlan = params.athletePlan;
  if (!athletePlan?.id) {
    athletePlan = await ensureAthletePlan(supabase, { orgId, teamId, athleteId, teamPlan });
  }

  const { error: pe } = await supabase
    .from('periodisation_plans')
    .update({
      start_date: teamPlan.start_date,
      end_date: teamPlan.end_date,
      name: teamPlan.name || athletePlan.name,
    })
    .eq('id', athletePlan.id)
    .eq('org_id', orgId);
  if (pe) throw pe;

  const { data: existingRows, error: rErr } = await supabase
    .from('plan_rows')
    .select('id')
    .eq('plan_id', athletePlan.id)
    .eq('org_id', orgId);
  if (rErr) throw rErr;
  const oldIds = (existingRows || []).map((r) => r.id);
  await deletePlanRowsAndCells(supabase, orgId, athletePlan.id, oldIds);

  const insertedRows = await insertRowsFromTeam(supabase, orgId, athletePlan.id, teamRows);
  const teamToAthleteRow = mapTeamRowIdsToInsertedAthleteRows(teamRows, insertedRows);

  const cellRows = (teamCells || [])
    .map((c) => {
      const newRid = teamToAthleteRow[c.row_id];
      if (!newRid) return null;
      return cellPayloadForInsert(orgId, newRid, c);
    })
    .filter(Boolean);

  if (cellRows.length) await insertCellsBatched(supabase, cellRows);
  return { planId: athletePlan.id };
}

/**
 * Build team row id → athlete row id using rowSyncKey.
 */
function buildTeamToAthleteRowMap(teamRows, athleteRows) {
  const athleteByKey = new Map();
  for (const ar of athleteRows) {
    const k = rowSyncKey(ar);
    if (!athleteByKey.has(k)) athleteByKey.set(k, ar.id);
  }
  const map = {};
  for (const tr of teamRows) {
    const aid = athleteByKey.get(rowSyncKey(tr));
    if (aid) map[tr.id] = aid;
  }
  return map;
}

/**
 * Update athlete plan from team: align rows by rowSyncKey, keep athlete-only rows
 * (no team row_key and no matching lbl key), remove athlete rows whose row_key
 * disappeared from the team, then fill cells from team only where the athlete
 * has no cell for that row/week (exact) or no overlapping span (band/text).
 */
export async function updateAthleteFromTeamPlan(supabase, params) {
  const { orgId, teamId, athleteId, teamPlan, teamRows, teamCells } = params;
  if (!teamPlan?.id) throw new Error('No team plan to sync from.');
  if (!teamRows?.length) throw new Error('Team plan has no rows.');

  let athletePlan = params.athletePlan;
  if (!athletePlan?.id) {
    return replaceAthleteWithTeamPlan(supabase, params);
  }

  const teamKeySet = new Set(teamRows.map((r) => rowSyncKey(r)));

  const { data: athleteRows, error: arErr } = await supabase
    .from('plan_rows')
    .select('*')
    .eq('plan_id', athletePlan.id)
    .eq('org_id', orgId)
    .order('sort_order');
  if (arErr) throw arErr;
  const aRows = athleteRows || [];

  for (const ar of aRows) {
    const rk = (ar.row_key || '').trim();
    const key = rowSyncKey(ar);
    const orphanKeyed = rk && !teamKeySet.has(key);
    if (!orphanKeyed) continue;
    const { error: de } = await supabase.from('plan_cells').delete().eq('org_id', orgId).eq('row_id', ar.id);
    if (de) throw de;
    const { error: dr } = await supabase.from('plan_rows').delete().eq('org_id', orgId).eq('id', ar.id);
    if (dr) throw dr;
  }

  const { data: athleteRowsAfter, error: ar2Err } = await supabase
    .from('plan_rows')
    .select('*')
    .eq('plan_id', athletePlan.id)
    .eq('org_id', orgId)
    .order('sort_order');
  if (ar2Err) throw ar2Err;
  const curAthleteRows = athleteRowsAfter || [];

  const athleteByKey = new Map();
  for (const ar of curAthleteRows) {
    const k = rowSyncKey(ar);
    if (!athleteByKey.has(k)) athleteByKey.set(k, ar);
  }

  for (const tr of teamRows) {
    const k = rowSyncKey(tr);
    const existing = athleteByKey.get(k);
    if (existing) {
      const { error: up } = await supabase
        .from('plan_rows')
        .update({
          label: tr.label,
          row_type: tr.row_type,
          sort_order: tr.sort_order,
          row_group: tr.row_group,
          row_key: tr.row_key ?? null,
          display_label: tr.display_label ?? null,
        })
        .eq('id', existing.id)
        .eq('org_id', orgId);
      if (up) throw up;
    } else {
      const { data: ins, error: insE } = await supabase
        .from('plan_rows')
        .insert({
          org_id: orgId,
          plan_id: athletePlan.id,
          row_group: tr.row_group,
          label: tr.label,
          row_type: tr.row_type,
          sort_order: tr.sort_order,
          row_key: tr.row_key ?? null,
          display_label: tr.display_label ?? null,
        })
        .select()
        .single();
      if (insE) throw insE;
      athleteByKey.set(k, ins);
    }
  }

  const { data: freshRows, error: frErr } = await supabase
    .from('plan_rows')
    .select('*')
    .eq('plan_id', athletePlan.id)
    .eq('org_id', orgId)
    .order('sort_order');
  if (frErr) throw frErr;
  const finalAthleteRows = freshRows || [];

  const rowIds = finalAthleteRows.map((r) => r.id);
  let freshCells = [];
  if (rowIds.length) {
    const { data: fc, error: fcErr } = await supabase
      .from('plan_cells')
      .select('*')
      .eq('org_id', orgId)
      .in('row_id', rowIds);
    if (fcErr) throw fcErr;
    freshCells = fc || [];
  }

  const teamToAthlete = buildTeamToAthleteRowMap(teamRows, finalAthleteRows);
  const weeks = weekStartsBetween(athletePlan.start_date, athletePlan.end_date);
  const toInsert = [];

  for (const tr of teamRows) {
    const athleteRowId = teamToAthlete[tr.id];
    if (!athleteRowId) continue;

    if (rowUsesSpanningCells(tr)) {
      for (const tc of teamCells || []) {
        if (tc.row_id !== tr.id || !tc.value_text || !tc.cell_date) continue;
        const tStart = tc.cell_date;
        const tEnd = tc.span_end_date || tc.cell_date;
        if (spanOverlapOnRow(freshCells, athleteRowId, tStart, tEnd)) continue;
        toInsert.push(cellPayloadForInsert(orgId, athleteRowId, tc));
      }
      continue;
    }

    for (const { monday } of weeks) {
      if (findExactCell(freshCells, athleteRowId, monday)) continue;
      const tc = findExactCell(teamCells || [], tr.id, monday);
      if (!tc) continue;
      toInsert.push(cellPayloadForInsert(orgId, athleteRowId, tc));
    }
  }

  if (toInsert.length) await insertCellsBatched(supabase, toInsert);
  return { planId: athletePlan.id };
}
