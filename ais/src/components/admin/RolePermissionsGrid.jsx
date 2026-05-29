import { Fragment, useEffect, useState } from 'react';
import { PERMISSION_CATEGORIES } from '../../lib/adminUserConstants';
import { supabase } from '../../lib/supabase';

const COLUMNS = [
  ['visible', 'Visible'],
  ['can_view', 'View'],
  ['can_create', 'Create'],
  ['can_edit', 'Edit'],
  ['can_delete', 'Delete'],
];

const COL_SPAN = 2 + COLUMNS.length;

const CRUD_FIELDS = ['can_view', 'can_create', 'can_edit', 'can_delete'];

function keyFor(roleId, resource) {
  return `${roleId}:${resource}`;
}

function isRowVisible(row) {
  return row.visible !== false;
}

function hasMisconfiguration(row) {
  return isRowVisible(row) && !row.can_view;
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
          .select('role_id, resource, visible, can_view, can_create, can_edit, can_delete, roles(name)')
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

  async function togglePermission(roleId, resource, field, checked) {
    if (!user?.orgId) return;
    const key = keyFor(roleId, resource);
    const current = permissions[key] ?? {
      role_id: roleId,
      resource,
      visible: true,
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

  function renderResourceRow(role, resource) {
    const row = permissions[keyFor(role.id, resource)] ?? {};
    const hidden = !isRowVisible(row);
    const warn = hasMisconfiguration(row);

    return (
      <tr
        key={`${role.id}-${resource}`}
        className={warn ? 'border-l-2 border-l-[var(--color-primary-container)]' : undefined}
        title={warn ? 'Tab will show but user cannot view data' : undefined}
      >
        <td className="px-4 py-3" />
        <td className="px-4 py-3 font-bold text-[var(--color-on-surface)]">
          <span className="inline-flex items-center gap-2">
            {warn && (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary-container)]"
                title="Tab will show but user cannot view data"
                aria-label="Tab will show but user cannot view data"
              />
            )}
            {resource}
          </span>
        </td>
        {COLUMNS.map(([field, label]) => {
          const inputKey = `${role.id}:${resource}:${field}`;
          const dimCrud = hidden && CRUD_FIELDS.includes(field);
          return (
            <td
              key={field}
              className={`px-4 py-3 text-center ${dimCrud ? 'pointer-events-none opacity-[0.35]' : ''}`}
            >
              <input
                aria-label={`${role.name} ${resource} ${label}`}
                type="checkbox"
                checked={field === 'visible' ? isRowVisible(row) : Boolean(row[field])}
                disabled={savingKey === inputKey}
                onChange={(event) => togglePermission(role.id, resource, field, event.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary-container)]"
              />
            </td>
          );
        })}
      </tr>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <div className="border-b border-[var(--color-outline-variant)] p-5">
        <h2 className="text-lg font-black text-[var(--color-on-surface)]">Roles</h2>
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Visible controls tab display; View/Create/Edit/Delete control data access.
        </p>
      </div>

      {error && <p className="p-5 text-sm text-[var(--color-error)]">{error}</p>}
      {loading && <p className="p-5 text-sm text-[var(--color-outline)]">Loading permissions...</p>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-[var(--color-outline)]">
              <tr>
                <th className="px-4 py-3 font-black">Role</th>
                <th className="px-4 py-3 font-black">Resource</th>
                {COLUMNS.map(([, label]) => (
                  <th key={label} className="px-4 py-3 text-center font-black">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]">
              {roles.map((role, roleIndex) => (
                <Fragment key={role.id}>
                  <tr
                    className={
                      roleIndex > 0
                        ? 'border-t-2 border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)]'
                        : 'bg-[var(--color-surface-container-low)]'
                    }
                  >
                    <td
                      colSpan={COL_SPAN}
                      className="px-4 py-2.5 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface)]"
                    >
                      {role.name}
                    </td>
                  </tr>
                  {PERMISSION_CATEGORIES.map((category) => (
                    <Fragment key={`${role.id}-${category.label}`}>
                      <tr className="bg-[var(--color-surface-container-high)]">
                        <td
                          colSpan={COL_SPAN}
                          className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]"
                        >
                          {category.label}
                        </td>
                      </tr>
                      {category.resources.map((resource) => renderResourceRow(role, resource))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
              {!roles.length && (
                <tr>
                  <td colSpan={COL_SPAN} className="px-5 py-8 text-center text-[var(--color-outline)]">
                    No roles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
