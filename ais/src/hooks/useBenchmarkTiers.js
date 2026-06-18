import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';
import {
  BENCHMARK_TIER_SELECT,
  DEFAULT_SCORING_METHOD,
  DEFAULT_TIERS,
  scoringMethodNeedsTiers,
} from '../lib/assessmentSettingsConstants';

function groupTiersByTest(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    if (!map.has(row.test_id)) map.set(row.test_id, []);
    map.get(row.test_id).push(row);
  }
  for (const tiers of map.values()) {
    tiers.sort((a, b) => a.tier_order - b.tier_order);
  }
  return map;
}

function buildDefaultTierRows(testId, orgId, teamId, scoringMethod) {
  return DEFAULT_TIERS.map((tier) => ({
    org_id: orgId,
    team_id: teamId,
    test_id: testId,
    scoring_method: scoringMethod,
    tier_order: tier.tier_order,
    tier_name: tier.tier_name,
    tier_color: tier.tier_color,
    threshold_min: null,
    threshold_max: null,
    percentile_min: null,
    percentile_max: null,
  }));
}

export function useBenchmarkTiers(selectedTeamId, activeTests, { onError } = {}) {
  const { user, activeOrgId } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const [tiersByTest, setTiersByTest] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeTestIds = useMemo(
    () => (activeTests ?? []).map((t) => t.id),
    [activeTests],
  );

  const activeTestIdsKey = useMemo(
    () => activeTestIds.join(','),
    [activeTestIds],
  );

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const notifyError = useCallback((err, label) => {
    console.error(`[useBenchmarkTiers] ${label}:`, err);
    onErrorRef.current?.(err.message ?? label);
  }, []);

  const reload = useCallback(async () => {
    if (!effectiveOrgId || !selectedTeamId || !activeTestIdsKey) {
      setTiersByTest(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('benchmark_tiers')
        .select(BENCHMARK_TIER_SELECT)
        .eq('org_id', effectiveOrgId)
        .eq('team_id', selectedTeamId)
        .in('test_id', activeTestIds)
        .order('tier_order', { ascending: true });
      if (error) throw error;
      setTiersByTest(groupTiersByTest(data));
    } catch (err) {
      notifyError(err, 'reload failed');
    } finally {
      setLoading(false);
    }
  }, [effectiveOrgId, selectedTeamId, activeTestIdsKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function getScoringMethod(testId) {
    const tiers = tiersByTest.get(testId);
    return tiers?.[0]?.scoring_method ?? DEFAULT_SCORING_METHOD;
  }

  function getTiersForTest(testId) {
    return tiersByTest.get(testId) ?? [];
  }

  async function setScoringMethod(testId, method) {
    if (!effectiveOrgId || !selectedTeamId || !testId) return;
    setSaving(true);
    try {
      const existing = tiersByTest.get(testId) ?? [];

      if (scoringMethodNeedsTiers(method) && existing.length === 0) {
        const rows = buildDefaultTierRows(testId, effectiveOrgId, selectedTeamId, method);
        const { error } = await supabase.from('benchmark_tiers').insert(rows);
        if (error) throw error;
      } else if (existing.length > 0) {
        const { error } = await supabase
          .from('benchmark_tiers')
          .update({ scoring_method: method })
          .eq('org_id', effectiveOrgId)
          .eq('team_id', selectedTeamId)
          .eq('test_id', testId);
        if (error) throw error;
      }
      await reload();
    } catch (err) {
      notifyError(err, 'setScoringMethod failed');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function upsertTier(testId, tierOrder, patch) {
    if (!effectiveOrgId || !selectedTeamId || !testId) return;
    setSaving(true);
    try {
      const existing = (tiersByTest.get(testId) ?? []).find((t) => t.tier_order === tierOrder);
      const scoringMethod = getScoringMethod(testId);

      if (existing?.id) {
        const { error } = await supabase
          .from('benchmark_tiers')
          .update(patch)
          .eq('id', existing.id)
          .eq('org_id', effectiveOrgId);
        if (error) throw error;
      } else {
        const base = DEFAULT_TIERS.find((t) => t.tier_order === tierOrder) ?? {
          tier_order: tierOrder,
          tier_name: `Tier ${tierOrder}`,
          tier_color: '--color-avg',
        };
        const { error } = await supabase.from('benchmark_tiers').insert({
          org_id: effectiveOrgId,
          team_id: selectedTeamId,
          test_id: testId,
          scoring_method: scoringMethod,
          tier_order: tierOrder,
          tier_name: base.tier_name,
          tier_color: base.tier_color,
          threshold_min: null,
          threshold_max: null,
          percentile_min: null,
          percentile_max: null,
          ...patch,
        });
        if (error) throw error;
      }
      await reload();
    } catch (err) {
      notifyError(err, 'upsertTier failed');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function addCustomTier(testId) {
    if (!effectiveOrgId || !selectedTeamId || !testId) return;
    setSaving(true);
    try {
      const existing = tiersByTest.get(testId) ?? [];
      const maxOrder = existing.reduce((max, row) => Math.max(max, row.tier_order ?? 0), 0);
      const scoringMethod = getScoringMethod(testId);
      const { error } = await supabase.from('benchmark_tiers').insert({
        org_id: effectiveOrgId,
        team_id: selectedTeamId,
        test_id: testId,
        scoring_method: scoringMethod,
        tier_order: maxOrder + 1,
        tier_name: 'Custom',
        tier_color: '--color-avg',
        threshold_min: null,
        threshold_max: null,
        percentile_min: null,
        percentile_max: null,
      });
      if (error) throw error;
      await reload();
    } catch (err) {
      notifyError(err, 'addCustomTier failed');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function deleteTier(tierId, tierOrder) {
    if (!effectiveOrgId || !tierId || tierOrder <= 4) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('benchmark_tiers')
        .delete()
        .eq('id', tierId)
        .eq('org_id', effectiveOrgId);
      if (error) throw error;
      await reload();
    } catch (err) {
      notifyError(err, 'deleteTier failed');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  return {
    tiersByTest,
    loading,
    saving,
    getScoringMethod,
    getTiersForTest,
    setScoringMethod,
    upsertTier,
    addCustomTier,
    deleteTier,
    reload,
  };
}
