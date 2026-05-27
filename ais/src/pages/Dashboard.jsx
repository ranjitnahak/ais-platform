import { useState } from 'react';
import StaffPageLayout from '../components/layout/StaffPageLayout';
import PageTabBar from '../components/layout/PageTabBar';
import WellnessDashboard from '../components/wellness/WellnessDashboard';
import DashboardRPEPanel from '../components/dashboard/DashboardRPEPanel';
import SquadDashboard from '../components/dashboard/SquadDashboard';

const TABS = [
  { id: 'wellness', label: 'Wellness' },
  { id: 'rpe', label: 'RPE' },
  { id: 'squad', label: 'Squad' },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('wellness');

  return (
    <StaffPageLayout title="Dashboard" subtitle="Team readiness, training load, and squad overview">
      <PageTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === 'wellness' && <WellnessDashboard embedded />}
      {activeTab === 'rpe' && <DashboardRPEPanel />}
      {activeTab === 'squad' && <SquadDashboard embedded />}
    </StaffPageLayout>
  );
}
