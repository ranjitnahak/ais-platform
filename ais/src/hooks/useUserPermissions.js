import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from '../lib/adminUserConstants';

const ACTION_FIELDS = {
  view: 'can_view',
  create: 'can_create',
  edit: 'can_edit',
  delete: 'can_delete',
};

function buildRoleDefaults(rows) {
  const map = {};
  for (const row of rows ?? []) {
    map[row.resource] = {
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

export function resolvePermissionState(roleDefaults, overrides, resource, action) {
  const field = ACTION_FIELDS[action];
  const overrideRow = overrides[resource];
  if (!overrideRow || overrideRow[field] == null) {
    return { state: 'inherited', value: Boolean(roleDefaults[resource]?.[field]) };
  }
  const value = Boolean(overrideRow[field]);
  return { state: value ? 'override_on' : 'override_off', value };
}

export async function saveOverride(userId, orgId, resource, action, value, createdBy, existingOverride) {
  const field = ACTION_FIELDS[action];
  const payload = {
    org_id: orgId,
    user_id: userId,
    resource,
    can_view: existingOverride?.can_view ?? null,
    can_create: existingOverride?.can_create ?? null,
    can_edit: existingOverride?.can_edit ?? null,
    can_delete: existingOverride?.can_delete ?? null,
    created_by: createdBy,
  };
  payload[field] = value;
  const { error } = await supabase
    .from('user_permission_overrides')
    .upsert(payload, { onConflict: 'user_id,resource' });
  if (error) throw error;
  return payload;
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

export function useUserPermissions(userId, activeOrgId) {
  const [roleDefaults, setRoleDefaults] = useState({});
  const [overrides, setOverrides] = useState({});
  const [roleName, setRoleName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [toggleError, setToggleError] = useState(null);

  const flashSaved = useCallback(() => {
    setSavedAt(Date.now());
    window.setTimeout(() => setSavedAt(null), 2000);
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const currentUser = await getCurrentUser();
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
        setOverrides({});
        return;
      }

      const [{ data: permRows, error: permError }, { data: overrideRows, error: ovError }] = await Promise.all([
        supabase
          .from('role_permissions')
          .select('resource, can_view, can_create, can_edit, can_delete')
          .eq('role_id', resolvedRoleId)
          .eq('org_id', orgId),
        supabase
          .from('user_permission_overrides')
          .select('resource, can_view, can_create, can_edit, can_delete')
          .eq('user_id', userId)
          .eq('org_id', orgId),
      ]);
      if (permError) throw permError;
      if (ovError) throw ovError;

      setRoleDefaults(buildRoleDefaults(permRows));
      setOverrides(buildOverrideMap(overrideRows));
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

  const resolvedMap = {};
  for (const resource of PERMISSION_RESOURCES) {
    resolvedMap[resource] = {};
    for (const [, action] of PERMISSION_ACTIONS) {
      resolvedMap[resource][action] = resolvePermissionState(roleDefaults, overrides, resource, action);
    }
  }

  const toggleOverride = async (resource, action) => {
    setToggleError(null);
    try {
      const currentUser = await getCurrentUser();
      const orgId = activeOrgId ?? currentUser?.orgId;
      if (!orgId) throw new Error('Not authenticated');
      const { state, value } = resolvePermissionState(roleDefaults, overrides, resource, action);
      const roleDefault = Boolean(roleDefaults[resource]?.[ACTION_FIELDS[action]]);
      const nextValue = state === 'inherited' ? !roleDefault : !value;
      const payload = await saveOverride(
        userId,
        orgId,
        resource,
        action,
        nextValue,
        currentUser.id,
        overrides[resource],
      );
      setOverrides((prev) => ({ ...prev, [resource]: payload }));
      flashSaved();
    } catch (err) {
      console.error('[useUserPermissions] toggleOverride', err);
      setToggleError(err.message || 'Could not save permission override.');
      throw err;
    }
  };

  const resetResource = async (resource) => {
    try {
      const currentUser = await getCurrentUser();
      const orgId = activeOrgId ?? currentUser?.orgId;
      if (!orgId) throw new Error('Not authenticated');
      await resetOverride(userId, orgId, resource);
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[resource];
        return next;
      });
      flashSaved();
    } catch (err) {
      console.error('[useUserPermissions] resetResource', err);
      throw err;
    }
  };

  const resetAll = async () => {
    try {
      const currentUser = await getCurrentUser();
      const orgId = activeOrgId ?? currentUser?.orgId;
      if (!orgId) throw new Error('Not authenticated');
      await resetAllOverrides(userId, orgId);
      setOverrides({});
      flashSaved();
    } catch (err) {
      console.error('[useUserPermissions] resetAll', err);
      throw err;
    }
  };

  return {
    loading,
    error,
    roleName,
    roleDefaults,
    overrides,
    resolvedMap,
    savedAt,
    toggleError,
    reload: load,
    toggleOverride,
    resetResource,
    resetAll,
  };
}
