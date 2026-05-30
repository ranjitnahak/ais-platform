import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser, canSync } from '../lib/auth';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';
import Sidebar from '../components/Sidebar';
import TabShell from '../components/layout/TabShell';

const SETTINGS_TABS = [
  { id: 'tests', label: 'Test Setup' },
];

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
        isActive ? 'bg-[#2a2a2c] text-white' : 'text-gray-500 hover:text-white',
      ].join(' ')}
      style={
        isActive
          ? { borderLeft: '2px solid #F97316', borderRadius: 0 }
          : { borderLeft: '2px solid transparent' }
      }
    >
      {label}
    </button>
  );
}

function TestSetupPanel() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const user = await getCurrentUser();
        const { data, error } = await supabase
          .from('test_definitions')
          .select('id, name, unit, direction')
          .eq('org_id', user.orgId)
          .order('name');
        if (error) throw error;
        setTests(data ?? []);
      } catch (err) {
        setLoadError(err.message ?? 'Could not load tests');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-bold text-white">Test Setup</h2>
        <p className="mt-0.5 text-[11px] text-gray-500">
          View the performance tests configured for your organisation
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-2xl text-[#F97316]">
            progress_activity
          </span>
        </div>
      ) : loadError ? (
        <p className="text-sm text-[#EF4444]">{loadError}</p>
      ) : (
        <div className="space-y-2">
          {tests.length === 0 ? (
            <p className="rounded-lg bg-[#2a2a2c] px-4 py-6 text-center text-sm text-gray-500">
              No tests configured for this organisation yet.
            </p>
          ) : (
            tests.map((test) => {
              const isHigher = test.direction !== 'lower';
              return (
                <div
                  key={test.id}
                  className="flex items-center gap-4 rounded-lg bg-[#2a2a2c] px-4 py-3"
                  style={{ border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <span className="flex-1 text-sm font-bold text-white">{test.name}</span>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {test.unit && (
                      <span className="rounded bg-[#353437] px-2 py-0.5 text-[10px] text-gray-400">
                        {test.unit}
                      </span>
                    )}
                    <span
                      className={[
                        'rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-widest',
                        isHigher
                          ? 'bg-[#22C55E]/10 text-[#22C55E]'
                          : 'bg-[#3B82F6]/10 text-[#3B82F6]',
                      ].join(' ')}
                    >
                      {isHigher ? 'Higher is better' : 'Lower is better'}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          <p className="mt-4 px-1 text-[10px] text-gray-600">
            Test definitions are configured at the platform level.
            Contact your administrator to add or modify tests.
          </p>
        </div>
      )}
    </div>
  );
}

function PreferencesPlaceholder() {
  return (
    <div>
      <h2 className="text-base font-bold text-white">Personal preferences</h2>
      <p className="mt-2 text-sm text-gray-500">
        Theme and view defaults will appear here in a future update.
      </p>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('tests');
  const { user, activeOrgId, loading } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);

  const panels = useMemo(
    () => ({
      tests: () => <TestSetupPanel />,
      preferences: () => <PreferencesPlaceholder />,
    }),
    [],
  );

  const tabs = useMemo(
    () => [
      ...SETTINGS_TABS,
      { id: 'preferences', label: 'Preferences' },
    ],
    [],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131315] font-['Inter'] text-[#e4e2e4]">
        <Sidebar />
      </div>
    );
  }

  if (!canSync(user, 'adminConfig', 'admin') && !user?.isSuperuser) {
    return (
      <div className="min-h-screen bg-[#131315] font-['Inter'] text-[#e4e2e4]">
        <Sidebar />
        <div className="flex min-h-screen items-center justify-center px-6 pb-32 pt-24 lg:pl-72">
          <p className="text-gray-500">Access restricted — admin permission required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131315] font-['Inter'] text-[#e4e2e4]">
      <Sidebar />

      <header className="fixed top-0 z-40 flex h-16 w-full items-center justify-between border-b border-white/5 bg-[#131315]/70 px-6 backdrop-blur-xl lg:pl-72">
        <h1 className="font-['Inter'] text-xl font-bold uppercase leading-none tracking-tight text-white">
          Settings
        </h1>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
          style={{
            color: '#F97316',
            background: 'rgba(249,115,22,0.1)',
            border: '1px solid rgba(249,115,22,0.2)',
          }}
        >
          Admin
        </span>
      </header>

      <main className="px-6 pb-32 pt-24 lg:pl-72">
        <TabShell
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          panels={panels}
          scopeKey={effectiveOrgId ?? 'settings'}
          className="flex min-h-[calc(100vh-6rem)] space-y-0"
          panelClassName="relative flex-1 pl-8 pt-2"
          renderTabBar={({ tabs: shellTabs, activeTab: tab, onTabChange, onTabHover }) => (
            <aside
              className="flex-shrink-0 pt-2"
              style={{ width: 180, borderRight: '1px solid rgba(255,255,255,0.05)' }}
            >
              <p className="px-4 pb-2 pt-4 text-[10px] uppercase tracking-widest text-gray-500">
                Configuration
              </p>
              {shellTabs.map((t) => (
                <NavItem
                  key={t.id}
                  label={t.label}
                  tabKey={t.id}
                  activeTab={tab}
                  onClick={() => onTabChange(t.id)}
                  onPrefetch={onTabHover ? () => onTabHover(t.id) : undefined}
                />
              ))}
            </aside>
          )}
        />
      </main>
    </div>
  );
}
