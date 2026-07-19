import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';
import { filterDashboardSubItems, getDefaultDashboardRoute } from '../nav/navResourceMap';
import StaffPageLayout from '../components/layout/StaffPageLayout';
import PersonalisedHeader from '../components/shared/PersonalisedHeader';
import DashboardSkeleton from '../components/shared/skeletons/DashboardSkeleton';
import { useIsMobile } from '../hooks/useIsMobile';

export default function Dashboard() {
  const { user, activeOrgId, loading: userLoading } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const visibleSubItems = filterDashboardSubItems(user);
  const isIndex = pathname === '/dashboard' || pathname === '/dashboard/';

  if (isIndex && !userLoading && user) {
    return <Navigate to={getDefaultDashboardRoute(user)} replace />;
  }

  return (
    <StaffPageLayout personalisedHeader showSearch>
      {!isMobile && !userLoading && user && <PersonalisedHeader user={user} />}

      {userLoading ? (
        <DashboardSkeleton />
      ) : visibleSubItems.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
          You do not have access to any dashboard views.
        </p>
      ) : (
        <div key={effectiveOrgId ?? 'dashboard'}>
          <Suspense fallback={<DashboardSkeleton contentOnly />}>
            <Outlet />
          </Suspense>
        </div>
      )}
    </StaffPageLayout>
  );
}
