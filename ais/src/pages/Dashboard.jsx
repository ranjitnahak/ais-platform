import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../context/UserContext';
import { isVisibleSync } from '../lib/auth';
import StaffPageLayout from '../components/layout/StaffPageLayout';
import PageTabBar from '../components/layout/PageTabBar';
import WellnessDashboard from '../components/wellness/WellnessDashboard';
import DashboardRPEPanel from '../components/dashboard/DashboardRPEPanel';
import DashboardSkeleton from '../components/shared/skeletons/DashboardSkeleton';

const ALL_TABS = [
  { id: 'wellness', label: 'Wellness', resource: 'wellness' },
  { id: 'rpe', label: 'RPE', resource: 'rpe_logging' },
];

export default function Dashboard() {
  const { user, loading: userLoading } = useUser();
  const [activeTab, setActiveTab] = useState('wellness');

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((tab) => !tab.resource || isVisibleSync(user, tab.resource)),
    [user],
  );

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  return (
    <StaffPageLayout title="Dashboard" subtitle="Team readiness, training load, and squad overview">
      {userLoading ? (
        <DashboardSkeleton />
      ) : visibleTabs.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
          You do not have access to any dashboard views.
        </p>
      ) : (
        <>
          <PageTabBar tabs={visibleTabs} activeTab={activeTab} onTabChange={setActiveTab} />
          {activeTab === 'wellness' && <WellnessDashboard embedded />}
          {activeTab === 'rpe' && <DashboardRPEPanel />}
        </>
      )}
    </StaffPageLayout>
  );
}
