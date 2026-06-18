import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { canSync } from '../lib/auth';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';
import { TEST_DEFINITION_SELECT } from '../lib/assessmentSettingsConstants';

export function useTestDefinitions(selectedTeamId, { onError } = {}) {
  const { user, activeOrgId } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canEdit = useMemo(
    () => canSync(user, 'assessments', 'edit') || Boolean(user?.isSuperuser),
    [user],
  );

  const notifyError = useCallback(
    (err, label) => {
      console.error(`[useTestDefinitions] ${label}:`, err);
      onError?.(err.message ?? label);
    },
    [onError],
  );

  const reload = useCallback(async () => {
    if (!effectiveOrgId || !selectedTeamId) {
      setTests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('test_definitions')
        .select(TEST_DEFINITION_SELECT)
        .eq('org_id', effectiveOrgId)
        .or(`team_id.eq.${selectedTeamId},team_id.is.null`)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setTests(data ?? []);
    } catch (err) {
      notifyError(err, 'reload failed');
    } finally {
      setLoading(false);
    }
  }, [effectiveOrgId, selectedTeamId, notifyError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeTests = useMemo(
    () => tests.filter((t) => t.is_active !== false),
    [tests],
  );

  async function createTest({ name, unit, direction = 'higher_is_better' }) {
    if (!effectiveOrgId || !selectedTeamId || !name?.trim()) return null;
    setSaving(true);
    try {
      const maxOrder = tests.reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0);
      const { data, error } = await supabase
        .from('test_definitions')
        .insert({
          org_id: effectiveOrgId,
          team_id: selectedTeamId,
          name: name.trim(),
          unit: unit?.trim() || null,
          direction,
          is_active: true,
          sort_order: maxOrder + 1,
        })
        .select(TEST_DEFINITION_SELECT)
        .single();
      if (error) throw error;
      await reload();
      return data;
    } catch (err) {
      notifyError(err, 'createTest failed');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function updateTest(id, patch) {
    if (!effectiveOrgId || !id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('test_definitions')
        .update(patch)
        .eq('id', id)
        .eq('org_id', effectiveOrgId);
      if (error) throw error;
      setTests((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    } catch (err) {
      notifyError(err, 'updateTest failed');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function deleteTest(test) {
    if (!effectiveOrgId || !test?.id) return;
    if (test.team_id == null) {
      const confirmed = window.confirm(
        'This test is shared org-wide. Delete it for all teams?',
      );
      if (!confirmed) return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('test_definitions')
        .delete()
        .eq('id', test.id)
        .eq('org_id', effectiveOrgId);
      if (error) throw error;
      await reload();
    } catch (err) {
      notifyError(err, 'deleteTest failed');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function reorderTests(orderedIds) {
    if (!effectiveOrgId || !orderedIds?.length) return;
    setSaving(true);
    try {
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('test_definitions')
          .update({ sort_order: index + 1 })
          .eq('id', id)
          .eq('org_id', effectiveOrgId),
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      await reload();
    } catch (err) {
      notifyError(err, 'reorderTests failed');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  return {
    tests,
    activeTests,
    loading,
    saving,
    canEdit,
    effectiveOrgId,
    createTest,
    updateTest,
    deleteTest,
    reorderTests,
    reload,
  };
}
