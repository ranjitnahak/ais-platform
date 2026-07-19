import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';
import { filterLogSubItems, getDefaultLogRoute } from '../nav/navResourceMap';
import StaffPageLayout from '../components/layout/StaffPageLayout';
import LogSkeleton from '../components/shared/skeletons/LogSkeleton';

export default function Log() {
  const { user, activeOrgId, loading: userLoading } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const { pathname } = useLocation();
  const visibleSubItems = filterLogSubItems(user);
  const isIndex = pathname === '/log' || pathname === '/log/';

  if (isIndex && !userLoading && user) {
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
