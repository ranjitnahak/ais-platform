import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';
import {
  copyDefaultWellnessTemplate,
  loadWellnessFormItemsAdmin,
  loadWellnessThresholds,
} from '../lib/loadWellnessFormItems';
import {
  INPUT_TYPES,
  slugifyWellnessKey,
  WELLNESS_FORM_ITEM_SELECT,
} from '../lib/wellnessFormConstants';

const EMPTY_FORM = {
  label: '',
  key: '',
  input_type: 'slider',
  scale_min: 1,
  scale_max: 5,
  scale_min_label: '',
  scale_max_label: '',
  direction: 'higher_better',
  is_required: true,
  label_hi: '',
  optionsText: '',
  threshold: '',
};

export function useWellnessFormAdmin() {
  const { user, activeOrgId } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const [items, setItems] = useState([]);
  const [thresholds, setThresholds] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!effectiveOrgId) {
      setItems([]);
      setThresholds({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [itemRows, thresholdRows] = await Promise.all([
        loadWellnessFormItemsAdmin(supabase, effectiveOrgId),
        loadWellnessThresholds(supabase, effectiveOrgId),
      ]);
      setItems(itemRows);
      setThresholds(
        Object.fromEntries((thresholdRows ?? []).map((row) => [row.item_key, row.threshold])),
      );
    } catch (err) {
      console.error('[useWellnessFormAdmin] reload failed:', err);
      setError(err.message ?? 'Could not load wellness form');
    } finally {
      setLoading(false);
    }
  }, [effectiveOrgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function copyTemplate() {
    if (!effectiveOrgId) return;
    setSaving(true);
    setError(null);
    try {
      await copyDefaultWellnessTemplate(supabase, effectiveOrgId);
      await reload();
    } catch (err) {
      setError(err.message ?? 'Could not copy template');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('wellness_form_items')
        .update({ is_active: !item.is_active })
        .eq('id', item.id)
        .eq('org_id', effectiveOrgId);
      if (updateError) throw updateError;
      await reload();
    } catch (err) {
      setError(err.message ?? 'Could not update item');
    } finally {
      setSaving(false);
    }
  }

  async function moveItem(item, direction) {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((row) => row.id === item.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return;

    const other = sorted[swapIndex];
    setSaving(true);
    setError(null);
    try {
      const updates = [
        supabase.from('wellness_form_items').update({ sort_order: other.sort_order }).eq('id', item.id),
        supabase.from('wellness_form_items').update({ sort_order: item.sort_order }).eq('id', other.id),
      ];
      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      await reload();
    } catch (err) {
      setError(err.message ?? 'Could not reorder items');
    } finally {
      setSaving(false);
    }
  }

  async function saveThreshold(itemKey, thresholdValue) {
    if (!effectiveOrgId || thresholdValue === '' || thresholdValue == null) return;
    setSaving(true);
    setError(null);
    try {
      const { error: upsertError } = await supabase
        .from('wellness_thresholds')
        .upsert(
          { org_id: effectiveOrgId, item_key: itemKey, threshold: Number(thresholdValue) },
          { onConflict: 'org_id,item_key' },
        );
      if (upsertError) throw upsertError;
      await reload();
    } catch (err) {
      setError(err.message ?? 'Could not save threshold');
    } finally {
      setSaving(false);
    }
  }

  async function addItem(form) {
    if (!effectiveOrgId) return;
    const key = form.key || slugifyWellnessKey(form.label);
    if (!key || !form.label) throw new Error('Label and key are required.');
    if (form.input_type === 'body_map' && items.some((row) => row.input_type === 'body_map')) {
      throw new Error('Only one body map question is allowed per organisation.');
    }

    const maxOrder = items.reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0);
    const payload = {
      org_id: effectiveOrgId,
      key,
      label: form.label,
      input_type: form.input_type,
      scale_min: form.input_type === 'slider' || form.input_type === 'number' ? Number(form.scale_min) : null,
      scale_max: form.input_type === 'slider' ? Number(form.scale_max) : null,
      scale_min_label: form.scale_min_label || null,
      scale_max_label: form.scale_max_label || null,
      direction: form.direction,
      sort_order: maxOrder + 1,
      is_required: Boolean(form.is_required),
      is_active: true,
      label_translations: form.label_hi ? { hi: form.label_hi } : {},
      options:
        form.input_type === 'radio'
          ? form.optionsText.split(',').map((opt) => opt.trim()).filter(Boolean)
          : null,
    };

    setSaving(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('wellness_form_items').insert(payload);
      if (insertError) throw insertError;
      if (form.threshold !== '' && form.threshold != null && ['slider', 'number'].includes(form.input_type)) {
        const { error: thresholdError } = await supabase
          .from('wellness_thresholds')
          .upsert(
            { org_id: effectiveOrgId, item_key: key, threshold: Number(form.threshold) },
            { onConflict: 'org_id,item_key' },
          );
        if (thresholdError) throw thresholdError;
      }
      await reload();
    } catch (err) {
      setError(err.message ?? 'Could not add question');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function updateItem(item, patch) {
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('wellness_form_items')
        .update(patch)
        .eq('id', item.id)
        .eq('org_id', effectiveOrgId);
      if (updateError) throw updateError;
      await reload();
    } catch (err) {
      setError(err.message ?? 'Could not update question');
    } finally {
      setSaving(false);
    }
  }

  return {
    items,
    thresholds,
    loading,
    saving,
    error,
    effectiveOrgId,
    copyTemplate,
    toggleActive,
    moveItem,
    saveThreshold,
    addItem,
    updateItem,
    reload,
    INPUT_TYPES,
    EMPTY_FORM,
  };
}

export { WELLNESS_FORM_ITEM_SELECT };
