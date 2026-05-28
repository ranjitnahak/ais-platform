import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import UserPermissionsTab from '../components/admin/UserPermissionsTab';
import { getCurrentUser } from '../lib/auth';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { setUserActive } from '../lib/adminUserActions';
import { useUserPermissions } from '../hooks/useUserPermissions';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function UserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { loading: authLoading, activeOrgId } = useUser();
  const [profile, setProfile] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [statusSaving, setStatusSaving] = useState(false);
  const permissions = useUserPermissions(userId, activeOrgId);

  useEffect(() => {
    if (!userId || authLoading) return;
    let mounted = true;
    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const actor = await getCurrentUser();
        if (!actor?.orgId) throw new Error('Not authenticated');
        const { data, error: userError } = await supabase
          .from('users')
          .select('id, full_name, email, phone, title, role, photo_url, is_active, created_at, deactivated_at, user_roles(group_id, roles(name))')
          .eq('id', userId)
          .eq('org_id', actor.orgId)
          .single();
        if (userError) throw userError;
        if (!mounted) return;
        setProfile(data);

        const groupIds = [...new Set((data.user_roles ?? []).map((r) => r.group_id).filter(Boolean))];
        if (groupIds.length) {
          const { data: teamRows } = await supabase
            .from('teams')
            .select('id, name')
            .eq('org_id', actor.orgId)
            .in('id', groupIds);
          if (mounted) setTeams(teamRows ?? []);
        } else {
          setTeams([]);
        }
      } catch (err) {
        console.error('[UserDetailPage] loadProfile', err);
        if (mounted) setError('Could not load user.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadProfile();
    return () => { mounted = false; };
  }, [userId, authLoading]);

  async function toggleActive() {
    if (!profile) return;
    setStatusSaving(true);
    try {
      const actor = await getCurrentUser();
      await setUserActive(actor.orgId, profile.id, !profile.is_active);
      setProfile((p) => ({
        ...p,
        is_active: !p.is_active,
        deactivated_at: !p.is_active ? null : new Date().toISOString(),
      }));
    } catch (err) {
      console.error('[UserDetailPage] toggleActive', err);
    } finally {
      setStatusSaving(false);
    }
  }

  const roleName = (() => {
    const ur = profile?.user_roles?.[0];
    const joined = Array.isArray(ur?.roles) ? ur.roles[0]?.name : ur?.roles?.name;
    return joined || profile?.role || '—';
  })();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)]">
        <Sidebar />
        <main className="px-6 py-24 md:pl-72"><p className="text-sm text-[var(--color-outline)]">Loading…</p></main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)]">
        <Sidebar />
        <main className="px-6 py-24 md:pl-72">
          <p className="text-sm text-[var(--color-error)]">{error || 'User not found.'}</p>
          <button type="button" onClick={() => navigate('/admin')} className="mt-4 text-sm text-[var(--color-primary-container)]">Back to admin</button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-on-surface)] font-['Inter']">
      <Sidebar />
      <main className="px-4 pb-16 pt-20 md:pl-72 md:pr-8">
        <button type="button" onClick={() => navigate('/admin')} className="mb-4 text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)] hover:text-[var(--color-on-surface)]">
          ← Admin
        </button>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            {profile.photo_url ? (
              <img src={profile.photo_url} alt="" className="h-16 w-16 rounded-full object-cover border-2 border-[var(--color-primary-container)]" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-variant)] text-lg font-black">
                {(profile.full_name || profile.email || '?').charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black">{profile.full_name || 'Unnamed'}</h1>
              <p className="text-sm text-[var(--color-on-surface-variant)]">{profile.email}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={statusSaving}
            onClick={toggleActive}
            className="rounded-lg border border-[var(--color-outline-variant)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] disabled:opacity-50"
          >
            {profile.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>

        <div className="mb-6 flex gap-1 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-1 w-fit">
          {['profile', 'permissions'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest ${
                activeTab === tab
                  ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
                  : 'text-[var(--color-on-surface-variant)]'
              }`}
            >
              {tab === 'profile' ? 'Profile' : 'Permissions'}
            </button>
          ))}
        </div>

        <section className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6">
          {activeTab === 'profile' ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div><dt className={labelClass}>Phone</dt><dd>{profile.phone || '—'}</dd></div>
              <div><dt className={labelClass}>Title</dt><dd>{profile.title || '—'}</dd></div>
              <div><dt className={labelClass}>Role</dt><dd>{roleName}</dd></div>
              <div>
                <dt className={labelClass}>Status</dt>
                <dd>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${profile.is_active ? 'bg-[var(--color-tertiary-container)]/20 text-[var(--color-tertiary-fixed-dim)]' : 'bg-[var(--color-surface-variant)] text-[var(--color-on-surface-variant)]'}`}>
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
              <div><dt className={labelClass}>Last active</dt><dd>{formatDate(profile.created_at)}</dd></div>
              <div className="sm:col-span-2">
                <dt className={labelClass}>Teams</dt>
                <dd>{teams.length ? teams.map((t) => t.name).join(', ') : '—'}</dd>
              </div>
            </dl>
          ) : (
            <UserPermissionsTab permissions={permissions} />
          )}
        </section>
      </main>
    </div>
  );
}

const labelClass = 'text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]';
