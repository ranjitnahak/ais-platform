import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';
import { isVisibleSync } from '../lib/auth';
import StaffPageLayout from '../components/layout/StaffPageLayout';
import PageTabBar from '../components/layout/PageTabBar';
import RPEEntryForm from '../components/log/RPEEntryForm';
import WellnessEntryForm from '../components/log/WellnessEntryForm';
import StaffNotes from './StaffNotes';
import LogSkeleton from '../components/shared/skeletons/LogSkeleton';

const ALL_TABS = [
  { id: 'rpe-entry', label: 'RPE Entry', resource: 'rpe_logging' },
  { id: 'wellness-entry', label: 'Wellness Entry', resource: 'wellness' },
  { id: 'assessment', label: 'Assessment', resource: 'assessments' },
  { id: 'staff-notes', label: 'Staff Notes', resource: 'staff_notes' },
];

function AssessmentTab() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center">
      <span className="material-symbols-outlined text-5xl text-[var(--color-outline)]">construction</span>
      <h2 className="mt-4 text-2xl font-black tracking-tight text-[var(--color-on-surface)]">Assessment</h2>
      <p className="mt-2 text-sm font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">Coming soon</p>
    </div>
  );
}

export default function Log() {
  const [activeTab, setActiveTab] = useState('rpe-entry');
  const { user, activeOrgId, loading: userLoading } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((tab) => isVisibleSync(user, tab.resource)),
    [user],
  );

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  return (
    <StaffPageLayout title="Log" subtitle="Record training and wellness data" showSearch={false}>
      {userLoading ? (
        <LogSkeleton />
      ) : visibleTabs.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
          You do not have access to any log views.
        </p>
      ) : (
        <>
          <PageTabBar tabs={visibleTabs} activeTab={activeTab} onTabChange={setActiveTab} />
          {activeTab === 'rpe-entry' && <RPEEntryForm key={effectiveOrgId ?? 'rpe'} />}
          {activeTab === 'wellness-entry' && <WellnessEntryForm key={effectiveOrgId ?? 'wellness'} />}
          {activeTab === 'assessment' && <AssessmentTab />}
          {activeTab === 'staff-notes' && <StaffNotes embedded key={effectiveOrgId ?? 'staff-notes'} />}
        </>
      )}
    </StaffPageLayout>
  );
}
