import { useState, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { canSync } from '../lib/auth';
import { getEffectiveOrgId } from '../lib/orgScope';
import Sidebar from '../components/Sidebar';
import TabShell from '../components/layout/TabShell';
import WellnessFormPanel from '../components/settings/WellnessFormPanel';
import SessionSetupPanel from '../components/settings/SessionSetupPanel';
import AssessmentSettings from './settings/AssessmentSettings';

const NAV_GROUPS = [
  {
    label: 'Configuration',
    tabs: [
      { id: 'wellness', label: 'Wellness Form' },
      { id: 'sessions', label: 'Session Setup' },
    ],
  },
  {
    label: 'Features',
    tabs: [{ id: 'assessments', label: 'Assessments' }],
  },
  {
    label: 'Account',
    tabs: [{ id: 'preferences', label: 'Preferences' }],
  },
];

const ALL_TABS = NAV_GROUPS.flatMap((group) => group.tabs);

function NavItem({ label, tabKey, activeTab, onClick, onPrefetch }) {
  const isActive = activeTab === tabKey;
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
      className={[
        'w-full text-left px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors',
        isActive
          ? 'bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)]'
          : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]',
      ].join(' ')}
      style={
        isActive
          ? { borderLeft: '2px solid var(--color-primary-container)', borderRadius: 0 }
          : { borderLeft: '2px solid transparent' }
      }
    >
      {label}
    </button>
  );
}

function PreferencesPlaceholder() {
  return (
    <div>
      <h2 className="text-base font-bold text-[var(--color-on-surface)]">Personal preferences</h2>
      <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
        Theme and view defaults will appear here in a future update.
      </p>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('assessments');
  const { user, activeOrgId, loading } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);

  const panels = useMemo(
    () => ({
      wellness: () => <WellnessFormPanel />,
      sessions: () => <SessionSetupPanel />,
      assessments: () => <AssessmentSettings />,
      preferences: () => <PreferencesPlaceholder />,
    }),
    [],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] font-['Inter'] text-[var(--color-on-background)]">
        <Sidebar />
      </div>
    );
  }

  if (!canSync(user, 'adminConfig', 'admin') && !user?.isSuperuser) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] font-['Inter'] text-[var(--color-on-background)]">
        <Sidebar />
        <div className="flex min-h-screen items-center justify-center px-6 pb-32 pt-24 lg:pl-72">
          <p className="text-[var(--color-on-surface-variant)]">Access restricted — admin permission required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] font-['Inter'] text-[var(--color-on-background)]">
      <Sidebar />

      <header className="fixed top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[var(--color-outline-variant)] bg-[color-mix(in_srgb,var(--color-background)_70%,transparent)] px-6 backdrop-blur-xl lg:pl-72">
        <h1 className="font-['Inter'] text-xl font-bold uppercase leading-none tracking-tight text-[var(--color-on-surface)]">
          Settings
        </h1>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
          style={{
            color: 'var(--color-primary-container)',
            background: 'color-mix(in srgb, var(--color-primary-container) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-primary-container) 20%, transparent)',
          }}
        >
          Admin
        </span>
      </header>

      <main className="px-6 pb-32 pt-24 lg:pl-72">
        <TabShell
          tabs={ALL_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          panels={panels}
          scopeKey={effectiveOrgId ?? 'settings'}
          className="flex min-h-[calc(100vh-6rem)] space-y-0"
          panelClassName="relative flex-1 pl-8 pt-2"
          renderTabBar={({ tabs: shellTabs, activeTab: tab, onTabChange, onTabHover }) => (
            <aside
              className="flex-shrink-0 pt-2"
              style={{ width: 180, borderRight: '1px solid var(--color-outline-variant)' }}
            >
              {NAV_GROUPS.map((group) => {
                const groupTabs = shellTabs.filter((t) =>
                  group.tabs.some((gt) => gt.id === t.id),
                );
                if (!groupTabs.length) return null;
                return (
                  <div key={group.label}>
                    <p className="px-4 pb-2 pt-4 text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                      {group.label}
                    </p>
                    {groupTabs.map((t) => (
                      <NavItem
                        key={t.id}
                        label={t.label}
                        tabKey={t.id}
                        activeTab={tab}
                        onClick={() => onTabChange(t.id)}
                        onPrefetch={onTabHover ? () => onTabHover(t.id) : undefined}
                      />
                    ))}
                  </div>
                );
              })}
            </aside>
          )}
        />
      </main>
    </div>
  );
}
