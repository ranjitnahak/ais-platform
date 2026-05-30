import { useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import UserList from '../components/admin/UserList';
import RolePermissionsGrid from '../components/admin/RolePermissionsGrid';
import TeamManagement from '../components/admin/TeamManagement';
import TabShell from '../components/layout/TabShell';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';

const ALL_TABS = [
  { id: 'users', label: 'Users' },
  { id: 'roles', label: 'Roles' },
  { id: 'teams', label: 'Teams' },
];

const ADMIN_ROLES = ['admin', 'superuser'];

function AdminTabBar({ tabs, activeTab, onTabChange, onTabHover }) {
  return (
    <div className="flex rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          onPointerEnter={onTabHover ? () => onTabHover(tab.id) : undefined}
          onFocus={onTabHover ? () => onTabHover(tab.id) : undefined}
          className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
            activeTab === tab.id
              ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
              : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function Admin() {
  const { user, activeOrgId, loading } = useUser();
  const [activeTab, setActiveTab] = useState('users');
  const canAccess = ADMIN_ROLES.includes(user?.role);
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);

  const panels = useMemo(
    () => ({
      users: () => <UserList user={user} />,
      roles: () => <RolePermissionsGrid user={user} />,
      teams: () => <TeamManagement user={user} effectiveOrgId={effectiveOrgId} />,
    }),
    [user, effectiveOrgId],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-on-surface)]">
        <Sidebar />
        <main className="px-6 py-24 lg:pl-72">
          <p className="text-sm uppercase tracking-widest text-[var(--color-outline)]">Loading admin panel...</p>
        </main>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-on-surface)] font-['Inter']">
        <Sidebar />
        <main className="px-6 py-24 lg:pl-72">
          <section className="max-w-xl rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8">
            <p className="text-xs font-black uppercase tracking-widest text-[var(--color-primary-container)]">Access Denied</p>
            <h1 className="mt-3 text-2xl font-black text-[var(--color-on-surface)]">Admin access required</h1>
            <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
              You need an Admin or Superuser role to view this page.
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-on-surface)] font-['Inter']">
      <Sidebar />
      <main className="px-4 pb-28 pt-20 lg:pb-16 lg:pl-72 md:pr-8">
        <TabShell
          tabs={ALL_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          panels={panels}
          scopeKey={effectiveOrgId ?? 'admin'}
          className="space-y-8"
          renderTabBar={(tabBarProps) => (
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary-container)]">Admin</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--color-on-surface)]">Admin Panel</h1>
                <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Manage users, roles, and teams for your org.</p>
              </div>
              <AdminTabBar {...tabBarProps} />
            </div>
          )}
        />
      </main>
    </div>
  );
}
