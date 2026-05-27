import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AddUserModal from './AddUserModal';
import DeleteUserModal from './DeleteUserModal';
import { setUserActive } from '../../lib/adminUserActions';

function roleName(row) {
  const roleRow = row.user_roles?.[0];
  const joined = Array.isArray(roleRow?.roles) ? roleRow.roles[0]?.name : roleRow?.roles?.name;
  return joined || row.role || 'Unassigned';
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function RowMenu({ row, onDeactivate, onReactivate, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="rounded p-1 text-[var(--color-outline)] hover:bg-[var(--color-surface-variant)] hover:text-[var(--color-on-surface)]"
        aria-label="User actions"
      >
        <span className="material-symbols-outlined text-lg">more_vert</span>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 min-w-[140px] rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] py-1 shadow-xl">
          {row.is_active ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(false); onDeactivate(row); }} className="block w-full px-4 py-2 text-left text-sm text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-bright)]">Deactivate</button>
          ) : (
            <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(false); onReactivate(row); }} className="block w-full px-4 py-2 text-left text-sm text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-bright)]">Reactivate</button>
          )}
          <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(row); }} className="block w-full px-4 py-2 text-left text-sm text-[var(--color-error)] hover:bg-[var(--color-error-container)]/20">Delete</button>
        </div>
      )}
    </div>
  );
}

export default function UserList({ user }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function loadUsers() {
    if (!user?.orgId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: userError } = await supabase
        .from('users')
        .select('id, full_name, email, role, is_active, created_at, deactivated_at, user_roles(roles(name), group_id)')
        .eq('org_id', user.orgId)
        .order('full_name');
      if (userError) throw userError;
      setUsers(data ?? []);
    } catch (err) {
      console.error('[UserList] load failed:', err);
      setError('Could not load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, [user?.orgId]);

  const rows = useMemo(() => users.map((row) => ({ ...row, roleName: roleName(row) })), [users]);

  async function handleDeactivate(row) {
    try {
      await setUserActive(user.orgId, row.id, false);
      await loadUsers();
    } catch (err) {
      console.error('[UserList] deactivate', err);
    }
  }

  async function handleReactivate(row) {
    try {
      await setUserActive(user.orgId, row.id, true);
      await loadUsers();
    } catch (err) {
      console.error('[UserList] reactivate', err);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <div className="flex flex-col gap-3 border-b border-[var(--color-outline-variant)] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-black text-[var(--color-on-surface)]">Users</h2>
          <p className="text-sm text-[var(--color-on-surface-variant)]">All users currently configured for this organisation.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="rounded-lg bg-[var(--color-primary-container)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)]"
        >
          Add User
        </button>
      </div>

      {error && <p className="p-5 text-sm text-[var(--color-error)]">{error}</p>}
      {loading && <p className="p-5 text-sm text-[var(--color-outline)]">Loading users...</p>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-[var(--color-outline)]">
              <tr>
                {['Full Name', 'Email', 'Role', 'Last Active', 'Status', ''].map((header) => (
                  <th key={header || 'actions'} className="px-5 py-3 font-black">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/admin/users/${row.id}`)}
                  className={`cursor-pointer transition-colors hover:bg-[var(--color-surface-container-high)] ${!row.is_active ? 'opacity-60' : ''}`}
                >
                  <td className="px-5 py-4 font-bold text-[var(--color-on-surface)]">
                    <div className="flex items-center gap-2">
                      {row.full_name || '—'}
                      {!row.is_active && (
                        <span className="rounded-full bg-[var(--color-surface-variant)] px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                          Inactive
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{row.email || '—'}</td>
                  <td className="px-5 py-4 text-[var(--color-on-surface)]">{row.roleName}</td>
                  <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{formatDate(row.created_at)}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                        row.is_active
                          ? 'bg-[var(--color-tertiary-container)]/20 text-[var(--color-tertiary-fixed-dim)]'
                          : 'bg-[var(--color-surface-variant)] text-[var(--color-on-surface-variant)]'
                      }`}
                    >
                      {row.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      row={row}
                      onDeactivate={handleDeactivate}
                      onReactivate={handleReactivate}
                      onDelete={setDeleteTarget}
                    />
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-[var(--color-outline)]">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddUserModal onClose={() => setShowAdd(false)} onCreated={loadUsers} />
      )}

      {deleteTarget && (
        <DeleteUserModal
          target={deleteTarget}
          orgId={user.orgId}
          onClose={() => setDeleteTarget(null)}
          onDeleted={loadUsers}
        />
      )}
    </section>
  );
}
