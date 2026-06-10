import { canSync } from '../../lib/auth';
import { useUser } from '../../context/UserContext';
import LoadMonitoringDashboard from './LoadMonitoringDashboard';

export default function DashboardRPEPanel() {
  const { user } = useUser();
  const canView = canSync(user, 'rpe_logging', 'view');

  if (!canView) {
    return (
      <p className="rounded-2xl bg-[var(--color-surface-container)] p-6 text-sm font-bold text-[var(--color-on-surface-variant)]">
        You do not have permission to view session RPE logs.
      </p>
    );
  }

  return <LoadMonitoringDashboard />;
}
