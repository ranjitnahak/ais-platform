import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AddUserModal from './AddUserModal';
import DeleteUserModal from './DeleteUserModal';
import { setUserActive } from '../../lib/adminUserActions';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusBadge(status) {
  if (status === 'ACTIVE') return 'bg-[var(--color-tertiary-container)]/20 text-[var(--color-tertiary-fixed-dim)]';
  if (status === 'INACTIVE') return 'bg-[var(--color-surface-variant)] text-[var(--color-on-surface-variant)]';
  return 'bg-[var(--color-primary-container)]/20 text-[var(--color-primary-container)]';
}

function RowMenu({ item, actions }) {
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
          {actions
            .filter((a) => !a.hidden)
            .map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  a.onClick(item);
                }}
                className={`block w-full px-4 py-2 text-left text-sm ${
                  a.variant === 'danger'
                    ? 'text-[var(--color-error)] hover:bg-[var(--color-error-container)]/20'
                    : 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-bright)]'
                }`}
              >
                {a.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default function UserList({ user }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function loadUsers() {
    if (!user?.orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [staffRes, athleteAuthRes, athletePendingRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, email, role, is_active, last_active_at, deactivated_at, athlete_id')
          .eq('org_id', user.orgId)
          .is('athlete_id', null)
          .order('full_name'),
        supabase
          .from('users')
          .select('id, full_name, email, role, is_active, last_active_at, deactivated_at, athlete_id, athletes!athlete_id(id, position, jersey_number, photo_url)')
          .eq('org_id', user.orgId)
          .eq('role', 'athlete')
          .order('full_name'),
        supabase
          .from('athletes')
          .select('id, first_name, last_name, email, is_active, position, jersey_number, photo_url')
          .eq('org_id', user.orgId)
          .is('auth_id', null)
          .eq('is_active', true)
          .order('first_name'),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (athleteAuthRes.error) throw athleteAuthRes.error;
      if (athletePendingRes.error) throw athletePendingRes.error;

      const staffItems = (staffRes.data ?? []).map((row) => ({
        key: `staff:${row.id}`,
        kind: 'staff',
        userId: row.id,
        athleteId: null,
        fullName: row.full_name,
        email: row.email,
        typeLabel: 'Staff',
        roleOrPosition: row.role,
        status: row.is_active ? 'ACTIVE' : 'INACTIVE',
        lastActiveAt: row.last_active_at,
        isActive: row.is_active,
      }));

      const athleteAuthItems = (athleteAuthRes.data ?? []).map((row) => {
        const joinedAthlete = Array.isArray(row.athletes) ? row.athletes[0] : row.athletes;
        return {
          key: `athlete-auth:${row.id}`,
          kind: 'athlete_auth',
          userId: row.id,
          athleteId: row.athlete_id ?? joinedAthlete?.id ?? null,
          fullName: row.full_name,
          email: row.email,
          typeLabel: 'Athlete',
          roleOrPosition: joinedAthlete?.position ?? 'Athlete',
          status: row.is_active ? 'ACTIVE' : 'INACTIVE',
          lastActiveAt: row.last_active_at,
          isActive: row.is_active,
        };
      });

      const pendingItems = (athletePendingRes.data ?? []).map((row) => ({
        key: `athlete-pending:${row.id}`,
        kind: 'athlete_pending',
        userId: null,
        athleteId: row.id,
        fullName: [row.first_name, row.last_name].filter(Boolean).join(' '),
        email: row.email,
        typeLabel: 'Athlete',
        roleOrPosition: row.position ?? 'Athlete',
        status: 'INVITE_PENDING',
        lastActiveAt: null,
        isActive: row.is_active,
      }));

      const combined = [...staffItems, ...athleteAuthItems, ...pendingItems].sort((a, b) =>
        String(a.fullName || '').localeCompare(String(b.fullName || '')),
      );
      setItems(combined);
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

  const rows = useMemo(() => items, [items]);

  async function handleDeactivate(item) {
    try {
      if (!item.userId) return;
      await setUserActive(user.orgId, item.userId, false);
      await loadUsers();
    } catch (err) {
      console.error('[UserList] deactivate', err);
    }
  }

  async function handleReactivate(item) {
    try {
      if (!item.userId) return;
      await setUserActive(user.orgId, item.userId, true);
      await loadUsers();
    } catch (err) {
      console.error('[UserList] reactivate', err);
    }
  }

  async function sendAthleteInvite(item) {
    try {
      if (!item.athleteId) throw new Error('No athlete id found.');
      if (!item.email) throw new Error('Athlete email is missing.');
      const { data: fnData, error: fnError } = await supabase.functions.invoke('invite-user', {
        body: {
          email: item.email,
          fullName: item.fullName,
          orgId: user.orgId,
          userType: 'athlete',
          athleteId: item.athleteId,
        },
      });
      if (fnError) throw new Error(fnError.message);
      if (fnData?.error) throw new Error(fnData.error);
      await loadUsers();
    } catch (err) {
      console.error('[UserList] send athlete invite', err);
      setError(err.message || 'Could not send invite.');
    }
  }

  async function deleteAthleteProfile(item) {
    try {
      if (!item.athleteId) return;
      const ok = window.confirm('Delete athlete profile permanently? This cannot be undone.');
      if (!ok) return;
      const { error: deleteError } = await supabase
        .from('athletes')
        .delete()
        .eq('org_id', user.orgId)
        .eq('id', item.athleteId);
      if (deleteError) throw deleteError;
      await loadUsers();
    } catch (err) {
      console.error('[UserList] delete athlete profile', err);
      setError('Could not delete athlete profile.');
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
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-[var(--color-outline)]">
              <tr>
                {['Full Name', 'Email', 'Type', 'Role / Position', 'Status', 'Last Active', ''].map((header) => (
                  <th key={header || 'actions'} className="px-5 py-3 font-black">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]">
              {rows.map((row) => (
                <tr
                  key={row.key}
                  onClick={() => {
                    if (row.kind === 'staff') navigate(`/admin/users/${row.userId}`);
                    else if (row.athleteId) navigate(`/athletes/${row.athleteId}`);
                  }}
                  className={`cursor-pointer transition-colors hover:bg-[var(--color-surface-container-high)] ${row.status === 'INACTIVE' ? 'opacity-60' : ''}`}
                >
                  <td className="px-5 py-4 font-bold text-[var(--color-on-surface)]">
                    <div className="flex items-center gap-2">
                      {row.fullName || '—'}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{row.email || '—'}</td>
                  <td className="px-5 py-4 text-[var(--color-on-surface)]">{row.typeLabel}</td>
                  <td className="px-5 py-4 text-[var(--color-on-surface)]">{row.roleOrPosition || '—'}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusBadge(row.status)}`}
                    >
                      {row.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{formatDate(row.lastActiveAt)}</td>
                  <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      item={row}
                      actions={[
                        {
                          label: 'View Profile',
                          onClick: (item) => {
                            if (item.kind === 'staff') navigate(`/admin/users/${item.userId}`);
                            else if (item.athleteId) navigate(`/athletes/${item.athleteId}`);
                          },
                        },
                        {
                          label: 'Send Invite',
                          hidden: row.kind !== 'athlete_pending',
                          onClick: sendAthleteInvite,
                        },
                        {
                          label: 'Resend Invite',
                          hidden: row.kind !== 'athlete_auth',
                          onClick: sendAthleteInvite,
                        },
                        {
                          label: row.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate',
                          hidden: row.kind === 'athlete_pending',
                          onClick: (item) => (item.status === 'ACTIVE' ? handleDeactivate(item) : handleReactivate(item)),
                        },
                        {
                          label: 'Delete',
                          variant: 'danger',
                          onClick: (item) => {
                            if (item.kind === 'staff' || item.kind === 'athlete_auth') setDeleteTarget(item);
                            else deleteAthleteProfile(item);
                          },
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan="7" className="px-5 py-8 text-center text-[var(--color-outline)]">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddUserModal
          onClose={() => {
            setShowAdd(false);
            void loadUsers();
          }}
          onCreated={loadUsers}
        />
      )}

      {deleteTarget && (
        <DeleteUserModal
          target={{
            id: deleteTarget.userId,
            full_name: deleteTarget.fullName,
            email: deleteTarget.email,
          }}
          orgId={user.orgId}
          onClose={() => setDeleteTarget(null)}
          onDeleted={loadUsers}
        />
      )}
    </section>
  );
}
