import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getCurrentUser } from '../lib/auth';

export const usePeriodisationPlan = (teamId, { athleteId = null, enabled = true } = {}) => {
  const [plan, setPlan] = useState(null);
  const [rows, setRows] = useState([]);
  const [cells, setCells] = useState([]);
  const [ghostPlan, setGhostPlan] = useState(null);
  const [ghostRows, setGhostRows] = useState([]);
  const [ghostCells, setGhostCells] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const user = getCurrentUser();

  const athleteIdRef = useRef(athleteId);
  const enabledRef = useRef(enabled);
  athleteIdRef.current = athleteId;
  enabledRef.current = enabled;

  const fetchPlan = useCallback(async () => {
    const enabledNow = enabledRef.current;
    const athleteIdNow = athleteIdRef.current;
    const u = getCurrentUser();

    if (!enabledNow) {
      setPlan(null);
      setRows([]);
      setCells([]);
      setGhostPlan(null);
      setGhostRows([]);
      setGhostCells([]);
      setInitialLoading(false);
      return;
    }

    if (!teamId || !u?.teamIds?.includes(teamId)) {
      setPlan(null);
      setRows([]);
      setCells([]);
      setGhostPlan(null);
      setGhostRows([]);
      setGhostCells([]);
      setInitialLoading(false);
      return;
    }

    let q = supabase
      .from('periodisation_plans')
      .select('*')
      .eq('org_id', u.orgId)
      .eq('team_id', teamId)
      .in('team_id', u.teamIds)
      .order('created_at', { ascending: false })
      .limit(1);

    if (athleteIdNow) q = q.eq('athlete_id', athleteIdNow);
    else q = q.is('athlete_id', null);

    const { data: planData, error: planErr } = await q.maybeSingle();
    if (planErr) {
      console.error(planErr);
      setPlan(null);
      setRows([]);
      setCells([]);
      setGhostPlan(null);
      setGhostRows([]);
      setGhostCells([]);
      setInitialLoading(false);
      return;
    }

    if (!planData) {
      // No athlete-specific plan yet — still fetch ghost (team) plan so canvas
      // can show date bounds and ghost cells
      if (athleteIdNow) {
        const { data: ghostPlanData } = await supabase
          .from('periodisation_plans')
          .select('*')
          .eq('org_id', u.orgId)
          .eq('team_id', teamId)
          .is('athlete_id', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setGhostPlan(ghostPlanData ?? null);

        if (ghostPlanData) {
          const { data: ghostRowData } = await supabase
            .from('plan_rows')
            .select('*')
            .eq('plan_id', ghostPlanData.id)
            .eq('org_id', u.orgId)
            .order('sort_order');

          setGhostRows(ghostRowData || []);

          if (ghostRowData?.length) {
            const ghostRowIds = ghostRowData.map((r) => r.id);
            const { data: ghostCellData } = await supabase
              .from('plan_cells')
              .select('*')
              .eq('org_id', u.orgId)
              .in('row_id', ghostRowIds);
            setGhostCells(ghostCellData || []);
          } else {
            setGhostCells([]);
          }
        } else {
          setGhostRows([]);
          setGhostCells([]);
        }
      } else {
        setGhostPlan(null);
        setGhostRows([]);
        setGhostCells([]);
      }

      setPlan(null);
      setRows([]);
      setCells([]);
      setInitialLoading(false);
      return;
    }

    setPlan(planData);

    const { data: rowData, error: rowErr } = await supabase
      .from('plan_rows')
      .select('*')
      .eq('plan_id', planData.id)
      .eq('org_id', u.orgId)
      .order('sort_order');

    if (rowErr) {
      console.error(rowErr);
      setRows([]);
      setCells([]);
      setGhostPlan(null);
      setGhostRows([]);
      setGhostCells([]);
      setInitialLoading(false);
      return;
    }

    setRows(rowData || []);

    if (rowData?.length) {
      const rowIds = rowData.map((r) => r.id);
      const { data: cellData, error: cellErr } = await supabase
        .from('plan_cells')
        .select('*')
        .eq('org_id', u.orgId)
        .in('row_id', rowIds);
      if (cellErr) console.error(cellErr);
      setCells(cellData || []);
    } else {
      setCells([]);
    }

    // If this is an athlete plan, also fetch the team plan as ghost layer
    if (athleteIdNow) {
      const { data: ghostPlanData } = await supabase
        .from('periodisation_plans')
        .select('*')
        .eq('org_id', u.orgId)
        .eq('team_id', teamId)
        .is('athlete_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ghostPlanData) {
        setGhostPlan(ghostPlanData);

        const { data: ghostRowData } = await supabase
          .from('plan_rows')
          .select('*')
          .eq('plan_id', ghostPlanData.id)
          .eq('org_id', u.orgId)
          .order('sort_order');

        setGhostRows(ghostRowData || []);

        if (ghostRowData?.length) {
          const ghostRowIds = ghostRowData.map((r) => r.id);
          const { data: ghostCellData } = await supabase
            .from('plan_cells')
            .select('*')
            .eq('org_id', u.orgId)
            .in('row_id', ghostRowIds);
          setGhostCells(ghostCellData || []);
        } else {
          setGhostCells([]);
        }
      } else {
        setGhostPlan(null);
        setGhostRows([]);
        setGhostCells([]);
      }
    } else {
      setGhostPlan(null);
      setGhostRows([]);
      setGhostCells([]);
    }

    setInitialLoading(false);
  }, [teamId]);

  useEffect(() => {
    void fetchPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teamId only; fetchPlan is stable for a given teamId
  }, [teamId]);

  const upsertCell = async (cellData) => {
    // Auto-create athlete plan if it doesn't exist yet
    if (!plan?.id && athleteIdRef.current) {
      const u = getCurrentUser();

      // 1. Create the individual plan using ghost plan dates
      const ghostPlanNow = ghostPlan;
      const { data: newPlan, error: planErr } = await supabase
        .from('periodisation_plans')
        .insert({
          org_id: u.orgId,
          team_id: teamId,
          athlete_id: athleteIdRef.current,
          name: 'Individual Plan',
          start_date: ghostPlanNow?.start_date ?? cellData.cell_date,
          end_date: ghostPlanNow?.end_date ?? cellData.cell_date,
        })
        .select()
        .single();
      if (planErr) throw planErr;

      // 2. Copy ghost rows into the new athlete plan
      // Build a map of ghostRowId -> newRowId for cell remapping
      const ghostRowIdMap = {};
      if (ghostRows.length > 0) {
        const rowInserts = ghostRows.map((r) => ({
          org_id: u.orgId,
          plan_id: newPlan.id,
          row_group: r.row_group,
          label: r.label,
          row_type: r.row_type,
          sort_order: r.sort_order,
          row_key: r.row_key ?? null,
          display_label: r.display_label ?? null,
        }));
        const { data: newRows, error: rowErr } = await supabase
          .from('plan_rows')
          .insert(rowInserts)
          .select();
        if (rowErr) throw rowErr;

        // Map old ghost row id -> new athlete row id by label+row_group
        ghostRows.forEach((ghostRow) => {
          const match = newRows.find(
            (nr) => nr.label === ghostRow.label && nr.row_group === ghostRow.row_group
          );
          if (match) ghostRowIdMap[ghostRow.id] = match.id;
        });
      }

      // 3. Remap cellData.row_id from ghost row to new athlete row
      const remappedRowId = ghostRowIdMap[cellData.row_id] ?? cellData.row_id;

      // 4. Refetch to load the new plan state
      await fetchPlan();

      // 5. Retry the upsert with the remapped row_id
      const remappedCellData = { ...cellData, row_id: remappedRowId };
      const payload = { ...remappedCellData, org_id: u.orgId };
      const { data, error } = await supabase
        .from('plan_cells')
        .upsert(payload)
        .select();
      if (error) throw error;
      if (data?.[0]) {
        setCells((prev) => [...prev, data[0]]);
      }
      return data?.[0] ?? null;
    }

    const tempId = cellData.id ? null : `temp-cell-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const payload = { ...cellData, org_id: user.orgId };

    setCells((prev) => {
      const idx = cellData.id
        ? prev.findIndex((c) => c.id === cellData.id)
        : prev.findIndex(
            (c) => c.row_id === cellData.row_id && c.cell_date === cellData.cell_date
          );
      const base = idx >= 0 ? prev[idx] : {};
      const optimistic = {
        ...base,
        ...cellData,
        id: cellData.id || tempId,
        org_id: user.orgId,
      };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = optimistic;
        return next;
      }
      return [...prev, optimistic];
    });

    try {
      const { data, error } = await supabase.from('plan_cells').upsert(payload).select();
      if (error) throw error;
      if (!data?.[0]) return null;

      const saved = data[0];
      setCells((prev) => {
        let next = tempId ? prev.filter((c) => c.id !== tempId) : [...prev];
        const byId = next.findIndex((c) => c.id === saved.id);
        if (byId >= 0) {
          next[byId] = saved;
          return next;
        }
        const byKey = next.findIndex(
          (c) => c.row_id === saved.row_id && c.cell_date === saved.cell_date
        );
        if (byKey >= 0) {
          next[byKey] = saved;
          return next;
        }
        return [...next, saved];
      });
      return saved;
    } catch (e) {
      await fetchPlan();
      throw e;
    }
  };

  const deletePlanCellById = async (id) => {
    setCells((prev) => prev.filter((c) => c.id !== id));
    try {
      const { error } = await supabase.from('plan_cells').delete().eq('id', id).eq('org_id', user.orgId);
      if (error) throw error;
    } catch (e) {
      await fetchPlan();
      throw e;
    }
  };

  const insertPlanRow = async (rowPayload) => {
    if (!plan?.id) return null;
    const tempId = `temp-row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const optimisticRow = {
      ...rowPayload,
      id: tempId,
      plan_id: plan.id,
      org_id: user.orgId,
    };
    setRows((prev) =>
      [...prev, optimisticRow].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    );

    try {
      const { data, error } = await supabase
        .from('plan_rows')
        .insert({ ...rowPayload, org_id: user.orgId, plan_id: plan.id })
        .select()
        .single();
      if (error) throw error;
      setRows((prev) =>
        prev
          .map((r) => (r.id === tempId ? data : r))
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      );
      return data;
    } catch (e) {
      setRows((prev) => prev.filter((r) => r.id !== tempId));
      throw e;
    }
  };

  const deletePlanRow = async (rowId) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    setCells((prev) => prev.filter((c) => c.row_id !== rowId));
    try {
      const { error } = await supabase.from('plan_rows').delete().eq('id', rowId).eq('org_id', user.orgId);
      if (error) throw error;
    } catch (e) {
      await fetchPlan();
      throw e;
    }
  };

  const updatePlanRow = async (rowId, patch) => {
    setRows((prev) =>
      prev
        .map((r) => (r.id === rowId ? { ...r, ...patch } : r))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    );
    try {
      const { data, error } = await supabase
        .from('plan_rows')
        .update(patch)
        .eq('id', rowId)
        .eq('org_id', user.orgId)
        .select()
        .single();
      if (error) throw error;
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? data : r)).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      );
      return data;
    } catch (e) {
      await fetchPlan();
      throw e;
    }
  };

  const reorderPlanRows = async (orderedIds) => {
    setRows((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]));
      return orderedIds.map((id, i) => ({ ...map.get(id), sort_order: i })).filter(Boolean);
    });
    try {
      const updates = orderedIds.map((id, i) =>
        supabase.from('plan_rows').update({ sort_order: i }).eq('id', id).eq('org_id', user.orgId)
      );
      await Promise.all(updates);
    } catch (e) {
      await fetchPlan();
      throw e;
    }
  };

  /** Each entry is `{ id, row_group }` in global display order (same as sort_order indices). */
  const reorderPlanRowsWithGroups = async (ordered) => {
    setRows((prev) => {
      const map = new Map(prev.map((x) => [x.id, x]));
      return ordered
        .map((r, i) => {
          const base = map.get(r.id);
          return base ? { ...base, sort_order: i, row_group: r.row_group } : null;
        })
        .filter(Boolean);
    });
    try {
      const updates = ordered.map((r, i) =>
        supabase
          .from('plan_rows')
          .update({ sort_order: i, row_group: r.row_group })
          .eq('id', r.id)
          .eq('org_id', user.orgId)
      );
      await Promise.all(updates);
    } catch (e) {
      await fetchPlan();
      throw e;
    }
  };

  /** Sets `display_label` on every row in this plan that belongs to `rowGroup` (section header). */
  const updateDisplayLabelForGroup = async (rowGroup, displayLabel) => {
    if (!plan?.id) return;
    const value = displayLabel?.trim() ? displayLabel.trim() : null;
    setRows((prev) => prev.map((r) => (r.row_group === rowGroup ? { ...r, display_label: value } : r)));
    try {
      const { error } = await supabase
        .from('plan_rows')
        .update({ display_label: value })
        .eq('plan_id', plan.id)
        .eq('org_id', user.orgId)
        .eq('row_group', rowGroup);
      if (error) throw error;
    } catch (e) {
      await fetchPlan();
      throw e;
    }
  };

  const updatePlanDates = async (startDate, endDate) => {
    if (!plan?.id) return;
    setPlan((prev) => ({ ...prev, start_date: startDate, end_date: endDate }));
    try {
      const { data, error } = await supabase
        .from('periodisation_plans')
        .update({ start_date: startDate, end_date: endDate })
        .eq('id', plan.id)
        .eq('org_id', user.orgId)
        .select()
        .single();
      if (error) throw error;
      setPlan(data);
    } catch (e) {
      await fetchPlan();
      throw e;
    }
  };

  return {
    plan,
    rows,
    cells,
    ghostPlan,
    ghostRows,
    ghostCells,
    initialLoading,
    fetchPlan,
    upsertCell,
    deletePlanCellById,
    insertPlanRow,
    deletePlanRow,
    updatePlanRow,
    reorderPlanRows,
    reorderPlanRowsWithGroups,
    updateDisplayLabelForGroup,
    updatePlanDates,
  };
};
