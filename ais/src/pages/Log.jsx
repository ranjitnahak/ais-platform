import { Suspense, useMemo } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';
import { filterLogSubItems, getDefaultLogRoute, isLogSubRouteVisible } from '../nav/navResourceMap';
import { STAFF_LOG_NAV } from '../nav/mobileNavItems';
import StaffPageLayout from '../components/layout/StaffPageLayout';
import NavPicker from '../components/layout/NavPicker';
import LogSkeleton from '../components/shared/skeletons/LogSkeleton';
import { useIsMobile } from '../hooks/useIsMobile';

export default function Log() {
  const { user, activeOrgId, loading: userLoading } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const visibleSubItems = filterLogSubItems(user);
  const isIndex = pathname === '/log' || pathname === '/log/';

  const pickerItems = useMemo(
    () => STAFF_LOG_NAV.filter((item) => isLogSubRouteVisible(user, item.to)),
    [user],
  );

  if (isIndex && !userLoading && user) {
    if (isMobile) {
      return (
        <StaffPageLayout title="Log" showSearch={false}>
          {pickerItems.length === 0 ? (
            <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
              You do not have access to any log views.
            </p>
          ) : (
            <NavPicker items={pickerItems} />
          )}
        </StaffPageLayout>
      );
    }
    return <Navigate to={getDefaultLogRoute(user)} replace />;
  }

  return (
    <StaffPageLayout title="Log" showSearch={false}>
      {userLoading ? (
        <LogSkeleton />
      ) : visibleSubItems.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
          You do not have access to any log views.
        </p>
      ) : (
        <div key={effectiveOrgId ?? 'log'}>
          <Suspense fallback={<LogSkeleton contentOnly />}>
            <Outlet />
          </Suspense>
        </div>
      )}
    </StaffPageLayout>
  );
}
