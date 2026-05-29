import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../context/UserContext';
import { isVisibleSync } from '../lib/auth';
import { getEffectiveOrgId } from '../lib/orgScope';
import StaffPageLayout from '../components/layout/StaffPageLayout';
import TabShell from '../components/layout/TabShell';
import PersonalisedHeader from '../components/shared/PersonalisedHeader';
import WellnessDashboard from '../components/wellness/WellnessDashboard';
import DashboardRPEPanel from '../components/dashboard/DashboardRPEPanel';
import DashboardSkeleton from '../components/shared/skeletons/DashboardSkeleton';
import { useIsMobile } from '../hooks/useIsMobile';

const ALL_TABS = [
  { id: 'wellness', label: 'Wellness', resource: 'wellness' },
  { id: 'rpe', label: 'RPE', resource: 'rpe_logging' },
];

export default function Dashboard() {
  const { user, activeOrgId, loading: userLoading } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('wellness');

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((tab) => !tab.resource || isVisibleSync(user, tab.resource)),
    [user],
  );

  const panels = useMemo(
    () => ({
      wellness: () => <WellnessDashboard embedded />,
      rpe: () => <DashboardRPEPanel />,
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
    <StaffPageLayout personalisedHeader showSearch>
      {!isMobile && !userLoading && user && <PersonalisedHeader user={user} />}

      {userLoading ? (
        <DashboardSkeleton />
      ) : visibleTabs.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
          You do not have access to any dashboard views.
        </p>
      ) : (
        <TabShell
          tabs={visibleTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          panels={panels}
          scopeKey={effectiveOrgId ?? 'dashboard'}
        />
      )}
    </StaffPageLayout>
  );
}
