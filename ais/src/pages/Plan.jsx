import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { filterStaffNavItems, isNavRouteVisible } from '../nav/navResourceMap';
import { STAFF_PLAN_NAV } from '../nav/mobileNavItems';
import StaffPageLayout from '../components/layout/StaffPageLayout';

export default function Plan() {
  const { user, loading: userLoading } = useUser();

  const pickerItems = useMemo(
    () => (user ? filterStaffNavItems(STAFF_PLAN_NAV, user) : []),
    [user],
  );

  if (userLoading) {
    return <StaffPageLayout title="Plan" showSearch={false} />;
  }

  if (!user || !isNavRouteVisible(user, '/plan')) {
    return (
      <StaffPageLayout title="Plan" showSearch={false}>
        <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
          You do not have access to plan views.
        </p>
      </StaffPageLayout>
    );
  }

  return <Navigate to={pickerItems[0]?.to ?? '/periodisation'} replace />;
}
