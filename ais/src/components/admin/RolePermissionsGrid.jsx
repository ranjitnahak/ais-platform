import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

const RESOURCES = [
  'assessments',
  'periodisation',
  'wellness',
  'rpe_logging',
  'injury_surveillance',
  'reports',
  'unified_reports',
  'athlete_portal',
  'sc_pro',
  'sessionLibrary',
  'athleteRoster',
  'adminConfig',
];

const ACTIONS = [
  ['can_view', 'View'],
  ['can_create', 'Create'],
  ['can_edit', 'Edit'],
  ['can_delete', 'Delete'],
];

function keyFor(roleId, resource) {
  return `${roleId}:${resource}`;
}

export default function RolePermissionsGrid({ user }) {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);

  async function loadPermissions() {
    if (!user?.orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: roleRows, error: roleError }, { data: permissionRows, error: permissionError }] = await Promise.all([
        supabase.from('roles').select('id, name').eq('org_id', user.orgId).order('name'),
        supabase
          .from('role_permissions')
          .select('role_id, resource, can_view, can_create, can_edit, can_delete, roles(name)')
          .eq('org_id', user.orgId),
      ]);
      if (roleError) throw roleError;
      if (permissionError) throw permissionError;
      const next = {};
      for (const row of permissionRows ?? []) next[keyFor(row.role_id, row.resource)] = row;
      setRoles(roleRows ?? []);
      setPermissions(next);
    } catch (err) {
      console.error('[RolePermissionsGrid] load failed:', err);
      setError('Could not load role permissions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPermissions();
  }, [user?.orgId]);

  const roleResourceRows = useMemo(
    () => roles.flatMap((role) => RESOURCES.map((resource) => ({ role, resource }))),
    [roles],
  );

  async function togglePermission(roleId, resource, field, checked) {
    if (!user?.orgId) return;
    const key = keyFor(roleId, resource);
    const current = permissions[key] ?? {
      role_id: roleId,
      resource,
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
    };
    const next = { ...current, [field]: checked };
    setPermissions((prev) => ({ ...prev, [key]: next }));
    setSavingKey(`${key}:${field}`);
    try {
      const { error: upsertError } = await supabase
        .from('role_permissions')
        .upsert({ ...next, org_id: user.orgId }, { onConflict: 'org_id,role_id,resource' });
      if (upsertError) throw upsertError;
    } catch (err) {
      console.error('[RolePermissionsGrid] save failed:', err);
      setError('Could not save permission.');
      setPermissions((prev) => ({ ...prev, [key]: current }));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <div className="border-b border-[var(--color-outline-variant)] p-5">
        <h2 className="text-lg font-black text-[var(--color-on-surface)]">Roles</h2>
        <p className="text-sm text-[var(--color-on-surface-variant)]">Toggle CRUD permissions for each role and resource.</p>
      </div>

      {error && <p className="p-5 text-sm text-[var(--color-error)]">{error}</p>}
      {loading && <p className="p-5 text-sm text-[var(--color-outline)]">Loading permissions...</p>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-[var(--color-outline)]">
              <tr>
                <th className="px-4 py-3 font-black">Role</th>
                <th className="px-4 py-3 font-black">Resource</th>
                {ACTIONS.map(([, label]) => (
                  <th key={label} className="px-4 py-3 text-center font-black">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]">
              {roleResourceRows.map(({ role, resource }) => {
                const row = permissions[keyFor(role.id, resource)] ?? {};
                return (
                  <tr key={`${role.id}-${resource}`}>
                    <td className="px-4 py-3 font-bold text-[var(--color-on-surface)]">{role.name}</td>
                    <td className="px-4 py-3 text-[var(--color-on-surface-variant)]">{resource}</td>
                    {ACTIONS.map(([field, label]) => {
                      const inputKey = `${role.id}:${resource}:${field}`;
                      return (
                        <td key={field} className="px-4 py-3 text-center">
                          <input
                            aria-label={`${role.name} ${resource} ${label}`}
                            type="checkbox"
                            checked={Boolean(row[field])}
                            disabled={savingKey === inputKey}
                            onChange={(event) => togglePermission(role.id, resource, field, event.target.checked)}
                            className="h-4 w-4 accent-[var(--color-primary-container)]"
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!roleResourceRows.length && (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-[var(--color-outline)]">No roles found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
