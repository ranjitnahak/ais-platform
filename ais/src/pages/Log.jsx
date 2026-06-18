import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';
import { isVisibleSync } from '../lib/auth';
import StaffPageLayout from '../components/layout/StaffPageLayout';
import TabShell from '../components/layout/TabShell';
import RPEEntryForm from '../components/log/RPEEntryForm';
import WellnessEntryForm from '../components/log/WellnessEntryForm';
import StaffNotes from './StaffNotes';
import DexaUploadTab from '../components/dexa/DexaUploadTab';
import LogSkeleton from '../components/shared/skeletons/LogSkeleton';
import AssessmentTab from './log/AssessmentTab';

const ALL_TABS = [
  { id: 'rpe-entry', label: 'RPE Entry', resource: 'rpe_logging' },
  { id: 'wellness-entry', label: 'Wellness Entry', resource: 'wellness' },
  { id: 'assessment', label: 'Assessment', resource: 'assessments' },
  { id: 'staff-notes', label: 'Staff Notes', resource: 'staff_notes' },
  { id: 'dexa', label: 'DEXA Upload' },
];

export default function Log() {
  const [activeTab, setActiveTab] = useState('rpe-entry');
  const { user, activeOrgId, activeTeamId, loading: userLoading } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((tab) => isVisibleSync(user, tab.resource)),
    [user],
  );

  const panels = useMemo(
    () => ({
      'rpe-entry': () => <RPEEntryForm />,
      'wellness-entry': () => <WellnessEntryForm />,
      assessment: () => <AssessmentTab />,
      'staff-notes': () => <StaffNotes embedded />,
      dexa: () => <DexaUploadTab />,
    }),
    [],
  );

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  return (
    <StaffPageLayout title="Log" showSearch={false}>
      {userLoading ? (
        <LogSkeleton />
      ) : visibleTabs.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
          You do not have access to any log views.
        </p>
      ) : (
        <TabShell
          tabs={visibleTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          panels={panels}
          scopeKey={`${effectiveOrgId ?? 'log'}-${activeTeamId ?? 'none'}`}
        />
      )}
    </StaffPageLayout>
  );
}
