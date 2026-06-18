import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '../../context/UserContext';
import { getEffectiveOrgId } from '../../lib/orgScope';
import TabShell from '../../components/layout/TabShell';
import TestBatteryTab from './TestBatteryTab';
import BenchmarksTab from './BenchmarksTab';
import PercentileBandsTab from './PercentileBandsTab';

const ASSESSMENT_TABS = [
  { id: 'battery', label: 'Test Battery' },
  { id: 'benchmarks', label: 'Benchmarks' },
  { id: 'bands', label: 'Percentile Bands', prefetch: false },
];

function TeamSelector({ teams, selectedTeamId, onChange }) {
  if (!teams?.length) {
    return (
      <p className="text-xs text-[var(--color-on-surface-variant)]">No teams available</p>
    );
  }

  if (teams.length === 1) {
    return (
      <div className="flex min-h-9 items-center rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-3 text-xs font-bold text-[var(--color-on-surface)]">
        {teams[0].name}
      </div>
    );
  }

  return (
    <select
      value={selectedTeamId ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-9 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-3 text-xs font-bold text-[var(--color-on-surface)]"
    >
      {teams.map((team) => (
        <option key={team.id} value={team.id}>{team.name}</option>
      ))}
    </select>
  );
}

function ToastBanner({ toast, onDismiss }) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div
      className={[
        'fixed bottom-24 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-bold',
        isError
          ? 'border border-[var(--color-error)] bg-[var(--color-surface-container-high)] text-[var(--color-error)]'
          : 'border border-[var(--color-primary-container)] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)]',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <span className="flex-1">{toast.message}</span>
        <button type="button" onClick={onDismiss} className="text-[var(--color-on-surface-variant)]">
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  );
}

function SubTabBar({ tabs, activeTab, onTabChange, onTabHover }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-[var(--color-outline-variant)] pb-3">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          onPointerEnter={onTabHover ? () => onTabHover(tab.id) : undefined}
          onFocus={onTabHover ? () => onTabHover(tab.id) : undefined}
          className={[
            'rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors',
            activeTab === tab.id
              ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
              : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function AssessmentSettings() {
  const { user, activeOrgId, availableTeams, activeTeamId } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const [teamOverride, setTeamOverride] = useState(null);
  const [activeTab, setActiveTab] = useState('battery');
  const [toast, setToast] = useState(null);

  const selectedTeamId = useMemo(() => {
    const ids = availableTeams?.map((t) => t.id) ?? [];
    if (!ids.length) return null;
    if (teamOverride && ids.includes(teamOverride)) return teamOverride;
    if (activeTeamId && ids.includes(activeTeamId)) return activeTeamId;
    return ids[0];
  }, [availableTeams, teamOverride, activeTeamId]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type });
  }, []);

  const showTeamSelector = activeTab === 'battery' || activeTab === 'benchmarks';

  const panels = useMemo(
    () => ({
      battery: () => (
        <TestBatteryTab selectedTeamId={selectedTeamId} onToast={showToast} />
      ),
      benchmarks: () => (
        <BenchmarksTab selectedTeamId={selectedTeamId} onToast={showToast} />
      ),
      bands: () => <PercentileBandsTab onToast={showToast} />,
    }),
    [selectedTeamId, showToast],
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-bold text-[var(--color-on-surface)]">Assessments</h2>
        <p className="mt-0.5 text-[11px] text-[var(--color-on-surface-variant)]">
          Test battery, benchmark tiers, and org-wide percentile bands
        </p>
      </div>

      {showTeamSelector && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
            Team
          </span>
          <TeamSelector
            teams={availableTeams}
            selectedTeamId={selectedTeamId}
            onChange={setTeamOverride}
          />
        </div>
      )}

      <TabShell
        tabs={ASSESSMENT_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        panels={panels}
        scopeKey={`${effectiveOrgId}-${selectedTeamId ?? 'none'}`}
        renderTabBar={SubTabBar}
      />

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
