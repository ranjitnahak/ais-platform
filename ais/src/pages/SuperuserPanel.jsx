import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

const TABS = ['Organisations', 'Feature Flags'];
const FEATURE_LABELS = {
  assessments: { label: 'Assessments', description: 'Physical testing and scoring' },
  periodisation: { label: 'Periodisation', description: 'Annual planning canvas' },
  sc_pro: { label: 'S&C Pro', description: 'Programme builder and athlete logging' },
  wellness: { label: 'Wellness', description: 'Daily athlete wellness check-ins' },
  rpe_logging: { label: 'RPE Logging', description: 'Post-session RPE from athletes' },
  injury_surveillance: { label: 'Injury Surveillance', description: 'Injury tracking and return-to-play' },
  athlete_portal: { label: 'Athlete Portal', description: 'Athlete-facing app access' },
  unified_reports: { label: 'Unified Reports', description: 'AI-powered athlete and team reports' },
  ai_assistant: { label: 'AI Assistant', description: 'S&C Pro AI programme builder' },
};

function AccessDenied() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-on-surface)] font-['Inter']">
      <Sidebar />
      <main className="px-6 py-24 md:pl-72">
        <section className="max-w-xl rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--color-primary-container)]">Access Denied</p>
          <h1 className="mt-3 text-2xl font-black">Superuser access required</h1>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Only platform superusers can access this panel.</p>
        </section>
      </main>
    </div>
  );
}

export default function SuperuserPanel() {
  const { user, loading } = useUser();
  const [activeTab, setActiveTab] = useState('Organisations');
  const [orgs, setOrgs] = useState([]);
  const [flags, setFlags] = useState([]);
  const [featureCounts, setFeatureCounts] = useState({});
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [pageError, setPageError] = useState(null);
  const selectedOrg = useMemo(() => orgs.find((org) => org.id === selectedOrgId), [orgs, selectedOrgId]);
  const flagMap = useMemo(() => flags.reduce((map, flag) => ({ ...map, [flag.feature_key]: flag }), {}), [flags]);

  useEffect(() => {
    if (user?.role === 'superuser') loadOrgs();
  }, [user]);

  useEffect(() => {
    if (selectedOrgId) loadFlags();
  }, [selectedOrgId]);

  async function loadOrgs() {
    try {
      setPageError(null);
      // Superuser exception: this intentionally reads every organisation.
      const { data: orgRows, error: orgError } = await supabase
        .from('organisations')
        .select('id, name, logo_url, created_at')
        .order('created_at', { ascending: false });
      if (orgError) throw orgError;
      // Superuser exception: platform-wide feature count by organisation.
      const { data: flagRows, error: flagError } = await supabase
        .from('org_feature_flags')
        .select('org_id, is_enabled');
      if (flagError) throw flagError;
      const counts = {};
      for (const row of flagRows ?? []) if (row.is_enabled) counts[row.org_id] = (counts[row.org_id] ?? 0) + 1;
      setFeatureCounts(counts);
      setOrgs(orgRows ?? []);
      setSelectedOrgId((current) => current || orgRows?.[0]?.id || '');
    } catch (err) {
      console.error('[SuperuserPanel] loadOrgs failed:', err);
      setPageError(err.message);
    }
  }

  async function loadFlags() {
    try {
      setPageError(null);
      const { data, error } = await supabase
        .from('org_feature_flags')
        .select('feature_key, is_enabled, enabled_at')
        .eq('org_id', selectedOrgId);
      if (error) throw error;
      setFlags(data ?? []);
    } catch (err) {
      console.error('[SuperuserPanel] loadFlags failed:', err);
      setPageError(err.message);
    }
  }

  async function toggleFeature(featureKey, currentValue) {
    try {
      const newValue = !currentValue;
      const { error } = await supabase
        .from('org_feature_flags')
        .upsert({
          org_id: selectedOrgId,
          feature_key: featureKey,
          is_enabled: newValue,
          enabled_at: newValue ? new Date().toISOString() : null,
          enabled_by: user.id,
        }, { onConflict: 'org_id,feature_key' });
      if (error) throw error;
      await loadFlags();
      await loadOrgs();
    } catch (err) {
      console.error('[SuperuserPanel] toggleFeature failed:', err);
      setPageError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-on-surface)]">
        <Sidebar />
        <main className="px-6 py-24 md:pl-72">Loading superuser panel...</main>
      </div>
    );
  }
  if (!user || user.role !== 'superuser') return <AccessDenied />;

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-on-surface)] font-['Inter']">
      <Sidebar />
      <main className="px-4 pb-16 pt-20 md:pl-72 md:pr-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary-container)]">Platform</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Superuser Panel</h1>
            <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Platform administration — all organisations</p>
          </div>
          <div className="flex rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-1">
            {TABS.map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest ${activeTab === tab ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]' : 'text-[var(--color-on-surface-variant)]'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>
        {pageError && <p className="mb-4 rounded-xl bg-[var(--color-error-container)] p-3 text-sm text-[var(--color-error)]">{pageError}</p>}
        {activeTab === 'Organisations' ? (
          <section className="overflow-hidden rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                <tr><th className="p-4">Logo</th><th>Org Name</th><th>Created</th><th>Active Features</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-t border-[var(--color-outline-variant)]">
                    <td className="p-4">{org.logo_url ? <img src={org.logo_url} alt={org.name} className="h-8 w-8 rounded-full object-cover" /> : <span className="material-symbols-outlined text-[var(--color-outline)]">business</span>}</td>
                    <td className="font-bold">{org.name}</td>
                    <td className="text-[var(--color-on-surface-variant)]">{org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}</td>
                    <td>{featureCounts[org.id] ?? 0}</td>
                    <td><button type="button" onClick={() => { setSelectedOrgId(org.id); setActiveTab('Feature Flags'); }} className="rounded-lg bg-[var(--color-primary-container)] px-3 py-2 text-xs font-black uppercase text-[var(--color-on-primary)]">Manage Features</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="space-y-5">
            <select value={selectedOrgId} onChange={(event) => setSelectedOrgId(event.target.value)} className="w-full max-w-md rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-3 text-sm font-bold">
              {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
            <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
              <div className="border-b border-[var(--color-outline-variant)] p-4">
                <h2 className="font-black">{selectedOrg?.name ?? 'Select organisation'}</h2>
              </div>
              {Object.entries(FEATURE_LABELS).map(([key, info]) => {
                const flag = flagMap[key];
                const enabled = Boolean(flag?.is_enabled);
                return (
                  <div key={key} className="flex items-center justify-between gap-4 border-b border-[var(--color-outline-variant)] p-4 last:border-b-0">
                    <div>
                      <h3 className="font-black">{info.label}</h3>
                      <p className="text-sm text-[var(--color-on-surface-variant)]">{info.description}</p>
                      {enabled && flag?.enabled_at && <p className="mt-1 text-xs text-[var(--color-primary)]">Enabled since {new Date(flag.enabled_at).toLocaleDateString()}</p>}
                    </div>
                    <button type="button" onClick={() => toggleFeature(key, enabled)} className={`h-7 w-14 rounded-full p-1 transition-colors ${enabled ? 'bg-[var(--color-primary-container)]' : 'bg-[var(--color-surface-container-high)]'}`}>
                      <span className={`block h-5 w-5 rounded-full bg-[var(--color-on-primary)] transition-transform ${enabled ? 'translate-x-7' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
