import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { filterStaffNavItems, isNavRouteVisible } from '../nav/navResourceMap';
import { STAFF_PLAN_NAV } from '../nav/mobileNavItems';
import StaffPageLayout from '../components/layout/StaffPageLayout';
import NavPicker from '../components/layout/NavPicker';
import { useIsMobile } from '../hooks/useIsMobile';

export default function Plan() {
  const { user, loading: userLoading } = useUser();
  const isMobile = useIsMobile();

  const pickerItems = useMemo(
    () => (user ? filterStaffNavItems(STAFF_PLAN_NAV, user) : []),
    [user],
  );

  if (!userLoading && user && !isMobile) {
    const fallback = pickerItems[0]?.to ?? '/periodisation';
    return <Navigate to={fallback} replace />;
  }

  if (!userLoading && user && !isNavRouteVisible(user, '/plan')) {
    return (
      <StaffPageLayout title="Plan" showSearch={false}>
        <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
          You do not have access to plan views.
        </p>
      </StaffPageLayout>
    );
  }

  return (
    <StaffPageLayout title="Plan" showSearch={false}>
      {userLoading ? null : pickerItems.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
          You do not have access to plan views.
        </p>
      ) : (
        <NavPicker items={pickerItems} />
      )}
    </StaffPageLayout>
  );
}
