import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import InviteUserModal from './InviteUserModal';

function roleName(row) {
  const roleRow = row.user_roles?.[0];
  const joined = Array.isArray(roleRow?.roles) ? roleRow.roles[0]?.name : roleRow?.roles?.name;
  return joined || row.role || 'Unassigned';
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function UserList({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInvite, setShowInvite] = useState(false);

  async function loadUsers() {
    if (!user?.orgId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: userError } = await supabase
        .from('users')
        .select('id, full_name, email, role, is_active, created_at, user_roles(roles(name))')
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

  return (
    <section className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <div className="flex flex-col gap-3 border-b border-[var(--color-outline-variant)] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-black text-[var(--color-on-surface)]">Users</h2>
          <p className="text-sm text-[var(--color-on-surface-variant)]">All users currently configured for this organisation.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="rounded-lg bg-[var(--color-primary-container)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)]"
        >
          Invite User
        </button>
      </div>

      {error && <p className="p-5 text-sm text-[var(--color-error)]">{error}</p>}
      {loading && <p className="p-5 text-sm text-[var(--color-outline)]">Loading users...</p>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-[var(--color-outline)]">
              <tr>
                {['Full Name', 'Email', 'Role', 'Teams', 'Last Active', 'Status'].map((header) => (
                  <th key={header} className="px-5 py-3 font-black">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 font-bold text-[var(--color-on-surface)]">{row.full_name || '-'}</td>
                  <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{row.email || '-'}</td>
                  <td className="px-5 py-4 text-[var(--color-on-surface)]">{row.roleName}</td>
                  <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">Configured by groups</td>
                  <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{formatDate(row.created_at)}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                        row.is_active
                          ? 'bg-[var(--color-tertiary-container)] text-[var(--color-on-tertiary)]'
                          : 'bg-[var(--color-surface-variant)] text-[var(--color-on-surface-variant)]'
                      }`}
                    >
                      {row.is_active ? 'Active' : 'Inactive'}
                    </span>
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

      {showInvite && (
        <InviteUserModal user={user} onClose={() => setShowInvite(false)} onCreated={loadUsers} />
      )}
    </section>
  );
}
