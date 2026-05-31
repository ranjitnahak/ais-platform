import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { filterUserListRows, formatUserListDate, userListStatusBadge } from '../../lib/adminUserListFilters';
import { formatRoleOrPosition } from '../../lib/adminUserConstants';
import AddUserModal from './AddUserModal';
import DeleteUserModal from './DeleteUserModal';
import AdminUserRowMenu from './AdminUserRowMenu';
import UserDetailPanel from './UserDetailPanel';
import { setUserActive } from '../../lib/adminUserActions';
import { buildGroupToTeamMap } from '../../lib/teamGroups';

async function resolveFunctionErrorMessage(fnError, fnData) {
  if (fnData?.error) return String(fnData.error);
  if (fnError?.context) {
    try {
      const body = await fnError.context.json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch (_) {
      // ignore parse errors
    }
  }
  return fnError?.message || 'Edge function request failed.';
}

export default function UserList({ user }) {
  const [items, setItems] = useState([]);
  const [panelTarget, setPanelTarget] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  async function loadUsers() {
    if (!user?.orgId && !user?.isSuperuser) return;
    setLoading(true);
    setError(null);
    try {
      const orgId = user.orgId;
      const scopedOrgId = user.isSuperuser
        ? (orgFilter === 'all' ? null : orgFilter)
        : orgId;
      const teamQuery = supabase
        .from('teams')
        .select('id, name, org_id, organisations(name)')
        .order('name');
      const teamRes = await (scopedOrgId ? teamQuery.eq('org_id', scopedOrgId) : teamQuery); // SUPERUSER: intentional cross-org query
      if (teamRes.error) throw teamRes.error;
      const teamRows = teamRes.data ?? [];
      const teamIds = teamRows.map((t) => t.id);
      setTeams(teamRows);
      const staffQuery = supabase
          .from('users')
          .select('id, full_name, email, role, is_active, last_login_at, deactivated_at, athlete_id, org_id, organisations(name)')
          .is('athlete_id', null)
          .order('full_name');
      const athleteAuthQuery = supabase
          .from('users')
          .select('id, full_name, email, role, is_active, last_login_at, deactivated_at, athlete_id, org_id, organisations(name), athletes!athlete_id(id, position, jersey_number, photo_url)')
          .eq('role', 'athlete')
          .order('full_name');
      const pendingQuery = supabase
          .from('athletes')
          .select('id, first_name, last_name, email, is_active, position, jersey_number, photo_url, org_id, auth_id, organisations(name)')
          .eq('is_active', true)
          .order('first_name');
      const userRolesQuery = supabase.from('user_roles').select('user_id, group_id, org_id');
      const athleteTeamsQuery = supabase.from('athlete_teams').select('athlete_id, team_id');
      const [staffRes, athleteAuthRes, athletePendingRes, userRolesRes, athleteTeamsRes] = await Promise.all([
        scopedOrgId ? staffQuery.eq('org_id', scopedOrgId) : staffQuery, // SUPERUSER: intentional cross-org query
        scopedOrgId ? athleteAuthQuery.eq('org_id', scopedOrgId) : athleteAuthQuery, // SUPERUSER: intentional cross-org query
        scopedOrgId ? pendingQuery.eq('org_id', scopedOrgId) : pendingQuery, // SUPERUSER: intentional cross-org query
        scopedOrgId ? userRolesQuery.eq('org_id', scopedOrgId) : userRolesQuery, // SUPERUSER: intentional cross-org query
        teamIds.length ? athleteTeamsQuery.in('team_id', teamIds) : Promise.resolve({ data: [], error: null }),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (athleteAuthRes.error) throw athleteAuthRes.error;
      if (athletePendingRes.error) throw athletePendingRes.error;
      if (userRolesRes.error) throw userRolesRes.error;
      if (athleteTeamsRes.error) throw athleteTeamsRes.error;

      const groupIdsByOrg = {};
      for (const row of userRolesRes.data ?? []) {
        if (!row.group_id || !row.org_id) continue;
        if (!groupIdsByOrg[row.org_id]) groupIdsByOrg[row.org_id] = [];
        groupIdsByOrg[row.org_id].push(row.group_id);
      }
      const groupToTeam = new Map();
      for (const [oid, gids] of Object.entries(groupIdsByOrg)) {
        const partial = await buildGroupToTeamMap(oid, gids);
        for (const [groupId, teamId] of partial) groupToTeam.set(groupId, teamId);
      }

      const athleteTeamMap = {};
      for (const row of athleteTeamsRes.data ?? []) {
        if (!athleteTeamMap[row.athlete_id]) athleteTeamMap[row.athlete_id] = [];
        athleteTeamMap[row.athlete_id].push(row.team_id);
      }
      const staffTeamMap = {};
      for (const row of userRolesRes.data ?? []) {
        const teamId = groupToTeam.get(row.group_id);
        if (!teamId || !teamIds.includes(teamId)) continue;
        if (!staffTeamMap[row.user_id]) staffTeamMap[row.user_id] = [];
        staffTeamMap[row.user_id].push(teamId);
      }

      const staffItems = (staffRes.data ?? []).map((row) => ({
        key: `staff:${row.id}`,
        kind: 'staff',
        userId: row.id,
        athleteId: null,
        fullName: row.full_name,
        email: row.email,
        typeLabel: 'Staff',
        roleOrPosition: row.role,
        orgId: row.org_id,
        orgName: row.organisations?.name ?? '—',
        status: row.is_active ? 'ACTIVE' : 'INACTIVE',
        lastActiveAt: row.last_login_at,
        isActive: row.is_active,
        teamIds: staffTeamMap[row.id] ?? [],
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
          orgId: row.org_id,
          orgName: row.organisations?.name ?? '—',
          status: row.is_active ? 'ACTIVE' : 'INACTIVE',
          lastActiveAt: row.last_login_at,
          isActive: row.is_active,
          teamIds: athleteTeamMap[row.athlete_id ?? joinedAthlete?.id] ?? [],
        };
      });
      const athleteAuthIds = new Set(
        athleteAuthItems
          .map((row) => row.athleteId)
          .filter(Boolean),
      );

      const pendingItems = (athletePendingRes.data ?? [])
        .filter((row) => !athleteAuthIds.has(row.id))
        .map((row) => ({
        key: `athlete-pending:${row.id}`,
        kind: 'athlete_pending',
        userId: null,
        athleteId: row.id,
        fullName: [row.first_name, row.last_name].filter(Boolean).join(' '),
        email: row.email,
        typeLabel: 'Athlete',
        roleOrPosition: row.position ?? 'Athlete',
        orgId: row.org_id,
        orgName: row.organisations?.name ?? '—',
        status: row.auth_id ? 'PROFILE_ONLY' : 'INVITE_PENDING',
        lastActiveAt: null,
        isActive: row.is_active,
        teamIds: athleteTeamMap[row.id] ?? [],
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
  }, [user?.orgId, user?.isSuperuser, orgFilter]);
  useEffect(() => {
    setTeamFilter('all');
  }, [orgFilter]);
  const rows = useMemo(
    () => filterUserListRows(items, { searchQuery, typeFilter, statusFilter })
      .filter((row) => (user.isSuperuser && orgFilter !== 'all' ? row.orgId === orgFilter : true))
      .filter((row) => (teamFilter !== 'all' ? row.teamIds?.includes(teamFilter) : true)),
    [items, searchQuery, typeFilter, statusFilter, user?.isSuperuser, orgFilter, teamFilter],
  );

  const selectClassName =
    'min-h-11 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-3 text-sm font-bold text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary-container)]';
  async function handleDeactivate(item) {
    try {
      if (!item.userId) return;
      await setUserActive(item.orgId ?? user.orgId, item.userId, false);
      await loadUsers();
    } catch (err) {
      console.error('[UserList] deactivate', err);
      setError(err.message || 'Could not deactivate user.');
    }
  }

  async function handleReactivate(item) {
    try {
      if (!item.userId) return;
      await setUserActive(item.orgId ?? user.orgId, item.userId, true);
      await loadUsers();
    } catch (err) {
      console.error('[UserList] reactivate', err);
      setError(err.message || 'Could not reactivate user.');
    }
  }
  function canResendInvite(row) {
    if (row.kind === 'athlete_pending' || row.kind === 'athlete_auth') return true;
    if (row.kind === 'staff' && row.status === 'INACTIVE') return true;
    return false;
  }

  async function sendAthleteInvite(item) {
    try {
      if (!item.athleteId) throw new Error('No athlete id found.');
      if (!item.email) throw new Error('Athlete email is missing.');
      setError(null);
      setSuccessMessage(null);
      const orgId = item.orgId ?? user.orgId;
      const { data: fnData, error: fnError } = await supabase.functions.invoke('invite-user', {
        body: {
          email: item.email,
          fullName: item.fullName,
          orgId,
          userType: 'athlete',
          athleteId: item.athleteId,
        },
      });
      if (fnError) throw new Error(await resolveFunctionErrorMessage(fnError, fnData));
      if (fnData?.error) throw new Error(fnData.error);
      setSuccessMessage(`Invite sent to ${item.email}. Ask the athlete to check spam if it is not in their inbox.`);
      await loadUsers();
    } catch (err) {
      console.error('[UserList] send athlete invite', err);
      setSuccessMessage(null);
      setError(err.message || 'Could not send invite.');
    }
  }

  async function sendStaffInvite(item) {
    try {
      if (!item.userId) throw new Error('No user id found.');
      if (!item.email) throw new Error('Staff email is missing.');
      setError(null);
      setSuccessMessage(null);
      const orgId = item.orgId ?? user.orgId;
      const roleEnum = item.roleOrPosition || 'sc_coach';
      const { data: fnData, error: fnError } = await supabase.functions.invoke('invite-user', {
        body: {
          email: item.email,
          fullName: item.fullName,
          orgId,
          userType: 'staff',
          roleEnum,
        },
      });
      if (fnError) throw new Error(await resolveFunctionErrorMessage(fnError, fnData));
      if (fnData?.error) throw new Error(fnData.error);
      setSuccessMessage(`Invite sent to ${item.email}. Ask them to check spam if it is not in their inbox.`);
      await loadUsers();
    } catch (err) {
      console.error('[UserList] send staff invite', err);
      setSuccessMessage(null);
      setError(err.message || 'Could not send invite.');
    }
  }

  async function resendInvite(item) {
    if (item.kind === 'staff') return sendStaffInvite(item);
    return sendAthleteInvite(item);
  }
  async function deleteAthleteProfile(item) {
    try {
      if (!item.athleteId) return;
      const ok = window.confirm('Delete athlete profile permanently? This cannot be undone.');
      if (!ok) return;
      const { data: deletedRows, error: deleteError } = await supabase
        .from('athletes')
        .delete()
        .select('id')
        .eq('org_id', item.orgId ?? user.orgId)
        .eq('id', item.athleteId);
      if (deleteError) throw deleteError;
      if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
        throw new Error('Delete was blocked by row-level permissions or the profile no longer exists.');
      }
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
      {successMessage && <p className="p-5 text-sm text-[var(--color-tertiary-fixed-dim)]">{successMessage}</p>}
      {loading && <p className="p-5 text-sm text-[var(--color-outline)]">Loading users...</p>}

      {!loading && !error && (
        <>
          <div className="space-y-2 border-b border-[var(--color-outline-variant)] px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name or email..."
                className="min-h-11 flex-1 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-4 text-sm text-[var(--color-on-surface)] outline-none transition focus:border-[var(--color-primary-container)]"
              />
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className={`${selectClassName} md:min-w-[140px]`}
                aria-label="Filter by type"
              >
                <option value="all">All</option>
                <option value="athlete">Athletes</option>
                <option value="staff">Staff</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={`${selectClassName} md:min-w-[160px]`}
                aria-label="Filter by status"
              >
                <option value="all">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="INVITE_PENDING">Invite Pending</option>
                <option value="PROFILE_ONLY">Profile Only</option>
              </select>
              {user.isSuperuser && (
                <select value={orgFilter} onChange={(event) => setOrgFilter(event.target.value)} className={`${selectClassName} md:min-w-[180px]`} aria-label="Filter by organisation">
                  <option value="all">All orgs</option>
                  {(user.allOrgs ?? []).map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
              )}
              <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className={`${selectClassName} md:min-w-[180px]`} aria-label="Filter by team">
                <option value="all">All teams</option>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </div>
            <p className="text-sm text-[var(--color-on-surface-variant)]">
              Showing {rows.length} of {items.length} users
            </p>
          </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-[var(--color-outline)]">
              <tr>
                {['Full Name', 'Email', 'Type', 'Role / Position', ...(user.isSuperuser ? ['Org'] : []), 'Status', 'Last Active', ''].map((header) => (
                  <th key={header || 'actions'} className="px-5 py-3 font-black">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]">
              {rows.map((row) => (
                <tr
                  key={row.key}
                  onClick={() => setPanelTarget(row)}
                  className={`cursor-pointer transition-colors hover:bg-[var(--color-surface-container-high)] ${row.status === 'INACTIVE' ? 'opacity-60' : ''}`}
                >
                  <td className="px-5 py-4 font-bold text-[var(--color-on-surface)]">
                    <div className="flex items-center gap-2">
                      {row.fullName || '—'}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{row.email || '—'}</td>
                  <td className="px-5 py-4 text-[var(--color-on-surface)]">{row.typeLabel}</td>
                  <td className="px-5 py-4 text-[var(--color-on-surface)]">{formatRoleOrPosition(row.roleOrPosition)}</td>
                  {user.isSuperuser && (
                    <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{row.orgName || '—'}</td>
                  )}
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${userListStatusBadge(row.status)}`}
                    >
                      {row.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{formatUserListDate(row.lastActiveAt)}</td>
                  <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <AdminUserRowMenu
                      item={row}
                      actions={[
                        {
                          label: 'View Profile',
                          onClick: (item) => setPanelTarget(item),
                        },
                        {
                          label: 'Resend Invite',
                          hidden: !canResendInvite(row),
                          onClick: resendInvite,
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
                  <td colSpan={user.isSuperuser ? 8 : 7} className="px-5 py-8 text-center text-[var(--color-outline)]">
                    {items.length ? 'No users match your search or filters.' : 'No users found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
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
          orgId={deleteTarget.orgId ?? user.orgId}
          onClose={() => setDeleteTarget(null)}
          onDeleted={loadUsers}
        />
      )}

      {panelTarget && (
        <UserDetailPanel
          target={panelTarget}
          onClose={() => setPanelTarget(null)}
          onUpdated={loadUsers}
        />
      )}
    </section>
  );
}
