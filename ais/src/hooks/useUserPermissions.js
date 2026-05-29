import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from '../lib/adminUserConstants';

const ACTION_FIELDS = {
  visible: 'visible',
  view: 'can_view',
  create: 'can_create',
  edit: 'can_edit',
  delete: 'can_delete',
};

const OVERRIDE_FIELDS = ['visible', 'can_view', 'can_create', 'can_edit', 'can_delete'];

function buildRoleDefaults(rows) {
  const map = {};
  for (const row of rows ?? []) {
    map[row.resource] = {
      visible: row.visible !== false,
      can_view: Boolean(row.can_view),
      can_create: Boolean(row.can_create),
      can_edit: Boolean(row.can_edit),
      can_delete: Boolean(row.can_delete),
    };
  }
  return map;
}

function buildOverrideMap(rows) {
  const map = {};
  for (const row of rows ?? []) {
    map[row.resource] = row;
  }
  return map;
}

function cloneOverrideMap(map) {
  return Object.fromEntries(
    Object.entries(map).map(([resource, row]) => [resource, { ...row }]),
  );
}

function isOverrideRowEmpty(row) {
  if (!row) return true;
  return OVERRIDE_FIELDS.every((field) => row[field] == null);
}

function overrideRowsEqual(a, b) {
  return OVERRIDE_FIELDS.every((field) => (a?.[field] ?? null) === (b?.[field] ?? null));
}

export function resolvePermissionState(roleDefaults, overrides, resource, action) {
  const field = ACTION_FIELDS[action];
  const overrideRow = overrides[resource];
  if (!overrideRow || overrideRow[field] == null) {
    const roleValue = action === 'visible'
      ? roleDefaults[resource]?.visible !== false
      : Boolean(roleDefaults[resource]?.[field]);
    return { state: 'inherited', value: roleValue };
  }
  const value = Boolean(overrideRow[field]);
  return { state: value ? 'override_on' : 'override_off', value };
}

function roleDefaultForAction(roleDefaults, resource, action) {
  if (action === 'visible') return roleDefaults[resource]?.visible !== false;
  return Boolean(roleDefaults[resource]?.[ACTION_FIELDS[action]]);
}

function applyToggleToDraft(roleDefaults, draftRow, resource, action) {
  const overrides = draftRow ? { [resource]: draftRow } : {};
  const { state, value } = resolvePermissionState(roleDefaults, overrides, resource, action);
  const roleDefault = roleDefaultForAction(roleDefaults, resource, action);
  const nextValue = state === 'inherited' ? !roleDefault : !value;
  const field = ACTION_FIELDS[action];
  const row = { ...(draftRow ?? {}) };
  if (nextValue === roleDefault) row[field] = null;
  else row[field] = nextValue;
  return isOverrideRowEmpty(row) ? undefined : row;
}

async function upsertOverrideRow(userId, orgId, resource, row, createdBy) {
  const payload = {
    org_id: orgId,
    user_id: userId,
    resource,
    visible: row.visible ?? null,
    can_view: row.can_view ?? null,
    can_create: row.can_create ?? null,
    can_edit: row.can_edit ?? null,
    can_delete: row.can_delete ?? null,
    created_by: createdBy,
  };
  const { data, error } = await supabase
    .from('user_permission_overrides')
    .upsert(payload, { onConflict: 'user_id,resource' })
    .select()
    .single();
  if (error) throw error;
  return data ?? payload;
}

export async function resetOverride(userId, orgId, resource) {
  const { error } = await supabase
    .from('user_permission_overrides')
    .delete()
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .eq('resource', resource);
  if (error) throw error;
}

export async function resetAllOverrides(userId, orgId) {
  const { error } = await supabase
    .from('user_permission_overrides')
    .delete()
    .eq('user_id', userId)
    .eq('org_id', orgId);
  if (error) throw error;
}

export function useUserPermissions(userId, activeOrgId, { onSaved } = {}) {
  const [roleDefaults, setRoleDefaults] = useState({});
  const [savedOverrides, setSavedOverrides] = useState({});
  const [draftOverrides, setDraftOverrides] = useState({});
  const [roleName, setRoleName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [editorUserId, setEditorUserId] = useState(null);

  const flashSaved = useCallback(() => {
    setSavedAt(Date.now());
    window.setTimeout(() => setSavedAt(null), 2000);
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    setSaveError(null);
    try {
      const currentUser = await getCurrentUser();
      setEditorUserId(currentUser?.id ?? null);
      const orgId = activeOrgId ?? currentUser?.orgId;
      if (!orgId) throw new Error('Not authenticated');

      const { data: targetUser, error: userError } = await supabase
        .from('users')
        .select('id, org_id, role')
        .eq('id', userId)
        .eq('org_id', orgId)
        .single();
      if (userError) throw userError;

      const { data: userRoleRows, error: urError } = await supabase
        .from('user_roles')
        .select('role_id, roles(id, name)')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .limit(1);
      if (urError) throw urError;

      const primary = userRoleRows?.[0];
      const joinedRole = Array.isArray(primary?.roles) ? primary.roles[0] : primary?.roles;
      const resolvedRoleId = primary?.role_id ?? null;
      setRoleName(joinedRole?.name ?? targetUser.role ?? 'Unassigned');

      if (!resolvedRoleId) {
        setRoleDefaults({});
        setSavedOverrides({});
        setDraftOverrides({});
        return;
      }

      const [{ data: permRows, error: permError }, { data: overrideRows, error: ovError }] = await Promise.all([
        supabase
          .from('role_permissions')
          .select('resource, visible, can_view, can_create, can_edit, can_delete')
          .eq('role_id', resolvedRoleId)
          .eq('org_id', orgId),
        supabase
          .from('user_permission_overrides')
          .select('resource, visible, can_view, can_create, can_edit, can_delete')
          .eq('user_id', userId)
          .eq('org_id', orgId),
      ]);
      if (permError) throw permError;
      if (ovError) throw ovError;

      const saved = buildOverrideMap(overrideRows);
      setRoleDefaults(buildRoleDefaults(permRows));
      setSavedOverrides(saved);
      setDraftOverrides(cloneOverrideMap(saved));
    } catch (err) {
      console.error('[useUserPermissions] load', err);
      setError('Could not load permissions.');
    } finally {
      setLoading(false);
    }
  }, [userId, activeOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = useMemo(() => {
    const keys = new Set([...Object.keys(savedOverrides), ...Object.keys(draftOverrides)]);
    for (const resource of keys) {
      if (!overrideRowsEqual(savedOverrides[resource], draftOverrides[resource])) return true;
    }
    return false;
  }, [savedOverrides, draftOverrides]);

  const isSelfEdit = Boolean(userId && editorUserId && userId === editorUserId);

  const resolvedMap = useMemo(() => {
    const map = {};
    for (const resource of PERMISSION_RESOURCES) {
      map[resource] = {
        visible: resolvePermissionState(roleDefaults, draftOverrides, resource, 'visible'),
      };
      for (const [, action] of PERMISSION_ACTIONS) {
        map[resource][action] = resolvePermissionState(roleDefaults, draftOverrides, resource, action);
      }
    }
    return map;
  }, [roleDefaults, draftOverrides]);

  const toggleDraft = useCallback((resource, action) => {
    setSaveError(null);
    setDraftOverrides((prev) => {
      const next = { ...prev };
      const row = applyToggleToDraft(roleDefaults, prev[resource], resource, action);
      if (row) next[resource] = row;
      else delete next[resource];
      return next;
    });
  }, [roleDefaults]);

  const discardDraft = useCallback(() => {
    setSaveError(null);
    setDraftOverrides(cloneOverrideMap(savedOverrides));
  }, [savedOverrides]);

  const resetResourceDraft = useCallback((resource) => {
    setSaveError(null);
    setDraftOverrides((prev) => {
      const next = { ...prev };
      delete next[resource];
      return next;
    });
  }, []);

  const saveAll = useCallback(async () => {
    if (!isDirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      const currentUser = await getCurrentUser();
      const orgId = activeOrgId ?? currentUser?.orgId;
      if (!orgId) throw new Error('Not authenticated');

      const resources = new Set([
        ...Object.keys(savedOverrides),
        ...Object.keys(draftOverrides),
      ]);

      const nextSaved = { ...savedOverrides };
      for (const resource of resources) {
        const draft = draftOverrides[resource];
        const saved = savedOverrides[resource];
        if (overrideRowsEqual(draft, saved)) continue;

        if (isOverrideRowEmpty(draft)) {
          if (saved) {
            await resetOverride(userId, orgId, resource);
            delete nextSaved[resource];
          }
        } else {
          const row = await upsertOverrideRow(userId, orgId, resource, draft, currentUser.id);
          nextSaved[resource] = row;
        }
      }

      setSavedOverrides(nextSaved);
      setDraftOverrides(cloneOverrideMap(nextSaved));
      flashSaved();
      onSaved?.({ targetUserId: userId, isSelfEdit: userId === currentUser?.id });
    } catch (err) {
      console.error('[useUserPermissions] saveAll', err);
      setSaveError(err.message || 'Could not save permissions.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [activeOrgId, draftOverrides, flashSaved, isDirty, onSaved, savedOverrides, userId]);

  const resetAll = async () => {
    try {
      const currentUser = await getCurrentUser();
      const orgId = activeOrgId ?? currentUser?.orgId;
      if (!orgId) throw new Error('Not authenticated');
      await resetAllOverrides(userId, orgId);
      setSavedOverrides({});
      setDraftOverrides({});
      flashSaved();
      onSaved?.({ targetUserId: userId, isSelfEdit: userId === currentUser?.id });
    } catch (err) {
      console.error('[useUserPermissions] resetAll', err);
      throw err;
    }
  };

  return {
    loading,
    saving,
    error,
    roleName,
    roleDefaults,
    overrides: draftOverrides,
    resolvedMap,
    savedAt,
    saveError,
    isDirty,
    isSelfEdit,
    reload: load,
    toggleOverride: toggleDraft,
    discardDraft,
    saveAll,
    resetResource: resetResourceDraft,
    resetAll,
  };
}
