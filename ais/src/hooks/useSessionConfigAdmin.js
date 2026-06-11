import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';
import {
  copyDefaultSessionConfig,
  loadSessionTypeOptionsAdmin,
  loadSessionVenueOptionsAdmin,
} from '../lib/loadSessionConfig';
import { slugifySessionTypeKey } from '../lib/sessionConfigConstants';

const EMPTY_TYPE_FORM = {
  label: '',
  key: '',
  default_venue: '',
};

const EMPTY_VENUE_FORM = {
  label: '',
};

export function useSessionConfigAdmin({ onSaved } = {}) {
  const { user, activeOrgId } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const [sessionTypes, setSessionTypes] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!effectiveOrgId) {
      setSessionTypes([]);
      setVenues([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [typeRows, venueRows] = await Promise.all([
        loadSessionTypeOptionsAdmin(supabase, effectiveOrgId),
        loadSessionVenueOptionsAdmin(supabase, effectiveOrgId),
      ]);
      setSessionTypes(typeRows);
      setVenues(venueRows);
    } catch (err) {
      console.error('[useSessionConfigAdmin] reload failed:', err);
      setError(err.message ?? 'Could not load session config');
    } finally {
      setLoading(false);
    }
  }, [effectiveOrgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function notifySaved() {
    await reload();
    if (onSaved) await onSaved();
  }

  async function copyTemplate() {
    if (!effectiveOrgId) return;
    setSaving(true);
    setError(null);
    try {
      await copyDefaultSessionConfig(supabase, effectiveOrgId);
      await notifySaved();
    } catch (err) {
      setError(err.message ?? 'Could not copy template');
    } finally {
      setSaving(false);
    }
  }

  async function toggleTypeActive(item) {
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('session_type_options')
        .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('org_id', effectiveOrgId);
      if (updateError) throw updateError;
      await notifySaved();
    } catch (err) {
      setError(err.message ?? 'Could not update session type');
    } finally {
      setSaving(false);
    }
  }

  async function toggleVenueActive(item) {
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('session_venue_options')
        .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('org_id', effectiveOrgId);
      if (updateError) throw updateError;
      await notifySaved();
    } catch (err) {
      setError(err.message ?? 'Could not update venue');
    } finally {
      setSaving(false);
    }
  }

  async function moveType(item, direction) {
    const sorted = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((row) => row.id === item.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return;

    const other = sorted[swapIndex];
    setSaving(true);
    setError(null);
    try {
      const results = await Promise.all([
        supabase
          .from('session_type_options')
          .update({ sort_order: other.sort_order, updated_at: new Date().toISOString() })
          .eq('id', item.id),
        supabase
          .from('session_type_options')
          .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
          .eq('id', other.id),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      await notifySaved();
    } catch (err) {
      setError(err.message ?? 'Could not reorder session types');
    } finally {
      setSaving(false);
    }
  }

  async function moveVenue(item, direction) {
    const sorted = [...venues].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((row) => row.id === item.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return;

    const other = sorted[swapIndex];
    setSaving(true);
    setError(null);
    try {
      const results = await Promise.all([
        supabase
          .from('session_venue_options')
          .update({ sort_order: other.sort_order, updated_at: new Date().toISOString() })
          .eq('id', item.id),
        supabase
          .from('session_venue_options')
          .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
          .eq('id', other.id),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      await notifySaved();
    } catch (err) {
      setError(err.message ?? 'Could not reorder venues');
    } finally {
      setSaving(false);
    }
  }

  async function addSessionType(form) {
    if (!effectiveOrgId) return;
    const key = form.key || slugifySessionTypeKey(form.label);
    if (!key || !form.label) throw new Error('Label is required.');
    if (sessionTypes.some((row) => row.key === key)) {
      throw new Error('A session type with this key already exists.');
    }

    const maxOrder = sessionTypes.reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0);
    setSaving(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('session_type_options').insert({
        org_id: effectiveOrgId,
        key,
        label: form.label.trim(),
        default_venue: form.default_venue?.trim() || null,
        sort_order: maxOrder + 1,
        is_active: true,
      });
      if (insertError) throw insertError;
      await notifySaved();
    } catch (err) {
      setError(err.message ?? 'Could not add session type');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function addVenue(form) {
    if (!effectiveOrgId) return;
    const label = form.label?.trim();
    if (!label) throw new Error('Venue name is required.');
    if (venues.some((row) => row.label.toLowerCase() === label.toLowerCase())) {
      throw new Error('This venue already exists.');
    }

    const maxOrder = venues.reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0);
    setSaving(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('session_venue_options').insert({
        org_id: effectiveOrgId,
        label,
        sort_order: maxOrder + 1,
        is_active: true,
      });
      if (insertError) throw insertError;
      await notifySaved();
    } catch (err) {
      setError(err.message ?? 'Could not add venue');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function updateSessionTypeLabel(item, label) {
    const trimmed = label?.trim();
    if (!trimmed || trimmed === item.label) return;
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('session_type_options')
        .update({ label: trimmed, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('org_id', effectiveOrgId);
      if (updateError) throw updateError;
      await notifySaved();
    } catch (err) {
      setError(err.message ?? 'Could not update session type');
    } finally {
      setSaving(false);
    }
  }

  async function updateVenueLabel(item, label) {
    const trimmed = label?.trim();
    if (!trimmed || trimmed === item.label) return;
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('session_venue_options')
        .update({ label: trimmed, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('org_id', effectiveOrgId);
      if (updateError) throw updateError;
      await notifySaved();
    } catch (err) {
      setError(err.message ?? 'Could not update venue');
    } finally {
      setSaving(false);
    }
  }

  return {
    sessionTypes,
    venues,
    loading,
    saving,
    error,
    effectiveOrgId,
    copyTemplate,
    toggleTypeActive,
    toggleVenueActive,
    moveType,
    moveVenue,
    addSessionType,
    addVenue,
    updateSessionTypeLabel,
    updateVenueLabel,
    reload,
    EMPTY_TYPE_FORM,
    EMPTY_VENUE_FORM,
  };
}
