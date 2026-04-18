import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getCurrentUser } from '../lib/auth';

export const usePeriodisationPlan = (teamId, { athleteId = null, enabled = true } = {}) => {
  const [plan, setPlan] = useState(null);
  const [rows, setRows] = useState([]);
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = getCurrentUser();

  const fetchPlan = useCallback(async () => {
    if (!enabled) {
      setPlan(null);
      setRows([]);
      setCells([]);
      setLoading(false);
      return;
    }

    if (!teamId || !user?.teamIds?.includes(teamId)) {
      setPlan(null);
      setRows([]);
      setCells([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    let q = supabase
      .from('periodisation_plans')
      .select('*')
      .eq('org_id', user.orgId)
      .eq('team_id', teamId)
      .in('team_id', user.teamIds)
      .order('created_at', { ascending: false })
      .limit(1);

    if (athleteId) q = q.eq('athlete_id', athleteId);
    else q = q.is('athlete_id', null);

    const { data: planData, error: planErr } = await q.maybeSingle();
    if (planErr) {
      console.error(planErr);
      setPlan(null);
      setRows([]);
      setCells([]);
      setLoading(false);
      return;
    }

    if (!planData) {
      setPlan(null);
      setRows([]);
      setCells([]);
      setLoading(false);
      return;
    }

    setPlan(planData);

    const { data: rowData, error: rowErr } = await supabase
      .from('plan_rows')
      .select('*')
      .eq('plan_id', planData.id)
      .eq('org_id', user.orgId)
      .order('sort_order');

    if (rowErr) {
      console.error(rowErr);
      setRows([]);
      setCells([]);
      setLoading(false);
      return;
    }

    setRows(rowData || []);

    if (rowData?.length) {
      const rowIds = rowData.map((r) => r.id);
      const { data: cellData, error: cellErr } = await supabase
        .from('plan_cells')
        .select('*')
        .eq('org_id', user.orgId)
        .in('row_id', rowIds);
      if (cellErr) console.error(cellErr);
      setCells(cellData || []);
    } else {
      setCells([]);
    }

    setLoading(false);
  }, [teamId, athleteId, enabled, user.orgId, user.teamIds]);

  useEffect(() => {
    // Data fetch on mount / when team or athlete scope changes
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchPlan updates loading/plan state from Supabase
    void fetchPlan();
  }, [fetchPlan]);

  const upsertCell = async (cellData) => {
    const payload = { ...cellData, org_id: user.orgId };
    const { data, error } = await supabase.from('plan_cells').upsert(payload).select();
    if (error) throw error;
    if (!data?.[0]) return null;
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.id === data[0].id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = data[0];
        return next;
      }
      return [...prev, data[0]];
    });
    return data[0];
  };

  const insertPlanRow = async (rowPayload) => {
    if (!plan?.id) return null;
    const { data, error } = await supabase
      .from('plan_rows')
      .insert({ ...rowPayload, org_id: user.orgId, plan_id: plan.id })
      .select()
      .single();
    if (error) throw error;
    setRows((prev) => [...prev, data].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    return data;
  };

  const deletePlanRow = async (rowId) => {
    const { error } = await supabase.from('plan_rows').delete().eq('id', rowId).eq('org_id', user.orgId);
    if (error) throw error;
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    setCells((prev) => prev.filter((c) => c.row_id !== rowId));
  };

  const updatePlanRow = async (rowId, patch) => {
    const { data, error } = await supabase
      .from('plan_rows')
      .update(patch)
      .eq('id', rowId)
      .eq('org_id', user.orgId)
      .select()
      .single();
    if (error) throw error;
    setRows((prev) => prev.map((r) => (r.id === rowId ? data : r)).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    return data;
  };

  const reorderPlanRows = async (orderedIds) => {
    const updates = orderedIds.map((id, i) =>
      supabase.from('plan_rows').update({ sort_order: i }).eq('id', id).eq('org_id', user.orgId)
    );
    await Promise.all(updates);
    setRows((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]));
      return orderedIds.map((id, i) => ({ ...map.get(id), sort_order: i })).filter(Boolean);
    });
  };

  return {
    plan,
    rows,
    cells,
    loading,
    fetchPlan,
    upsertCell,
    insertPlanRow,
    deletePlanRow,
    updatePlanRow,
    reorderPlanRows,
  };
};
