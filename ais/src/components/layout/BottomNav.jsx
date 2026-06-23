import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { getUserAccountLabels, signOutAndRedirect } from '../../lib/authSession';
import {
  STAFF_BOTTOM_NAV,
  STAFF_MORE_NAV,
  STAFF_PLAN_NAV,
  STAFF_DASHBOARD_NAV,
  STAFF_LOG_NAV,
  ATHLETE_BOTTOM_NAV,
  ATHLETE_MORE_NAV,
} from '../../nav/mobileNavItems';
import { filterStaffNavItems, isDashboardSubRouteVisible, isLogSubRouteVisible, isNavRouteVisible } from '../../nav/navResourceMap';

const ADMIN_ROLES = ['admin', 'superuser'];

function filterStaffItems(items, user) {
  return filterStaffNavItems(
    items.filter((item) => {
      if (item.adminOnly && !ADMIN_ROLES.includes(user?.role)) return false;
      if (item.superuserOnly && !user?.isSuperuser) return false;
      return true;
    }),
    user,
  );
}

function isRouteActive(pathname, to) {
  if (to === '/dashboard/wellness' || to === '/athlete-home') {
    return pathname === to || pathname.startsWith('/dashboard/');
  }
  if (to === '/log') {
    return pathname === '/log' || pathname.startsWith('/log/');
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavIcon({ icon, active }) {
  return (
    <span
      className="material-symbols-outlined leading-none"
      style={{
        fontSize: 22,
        fontVariationSettings: active ? "'FILL' 1" : undefined,
        color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
      }}
    >
      {icon}
    </span>
  );
}

function MoreSheet({ open, items, planItems, dashboardItems, logItems, showPlanSection, showDashboardSection, showLogSection, onClose, pathname, user }) {
  const navigate = useNavigate();
  const { displayName, roleLabel } = getUserAccountLabels(user);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const renderNavRow = (item, indent = false) => {
    const active = isRouteActive(pathname, item.to);
    return (
      <button
        type="button"
        className={`flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-[var(--color-surface-container)] ${
          indent ? 'pl-10 pr-6' : 'px-6'
        }`}
        onClick={() => {
          onClose();
          navigate(item.to);
        }}
      >
        <NavIcon icon={item.icon} active={active} />
        <span
          className={`font-bold tracking-tight ${indent ? 'text-xs uppercase' : 'text-sm'}`}
          style={{
            color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
          }}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="presentation">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-[var(--color-outline-variant)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)]"
        role="dialog"
        aria-modal="true"
        aria-label="More navigation"
      >
        <div className="flex justify-center pt-3 pb-2">
          <span className="h-1 w-10 rounded-full bg-[var(--color-outline-variant)]" aria-hidden />
        </div>
        <div className="flex items-center gap-4 px-6 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] text-[var(--color-outline)]">
            <span className="material-symbols-outlined text-lg">person</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--color-on-surface)]">{displayName}</p>
            <p className="mt-0.5 truncate text-xs text-[var(--color-on-surface-variant)]">{roleLabel}</p>
          </div>
        </div>
        <div className="mx-4 border-t border-[var(--color-outline-variant)]" />
        <ul className="pb-2">
          {showDashboardSection && dashboardItems.length > 0 && (
            <>
              <li>
                <p className="px-6 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                  Dashboard
                </p>
              </li>
              {dashboardItems.map((item) => (
                <li key={item.to}>
                  <div className="mx-4 border-t border-[var(--color-outline-variant)]" />
                  {renderNavRow(item, true)}
                </li>
              ))}
            </>
          )}
          {showPlanSection && planItems.length > 0 && (
            <>
              <li>
                <p className="px-6 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                  Plan
                </p>
              </li>
              {planItems.map((item) => (
                <li key={item.to}>
                  <div className="mx-4 border-t border-[var(--color-outline-variant)]" />
                  {renderNavRow(item, true)}
                </li>
              ))}
            </>
          )}
          {showLogSection && logItems.length > 0 && (
            <>
              <li>
                <p className="px-6 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                  Log
                </p>
              </li>
              {logItems.map((item) => (
                <li key={item.to}>
                  <div className="mx-4 border-t border-[var(--color-outline-variant)]" />
                  {renderNavRow(item, true)}
                </li>
              ))}
            </>
          )}
          {items.map((item, index) => (
            <li key={item.to}>
              {(index > 0 ||
                (showPlanSection && planItems.length > 0) ||
                (showDashboardSection && dashboardItems.length > 0) ||
                (showLogSection && logItems.length > 0)) && (
                <div className="mx-4 border-t border-[var(--color-outline-variant)]" />
              )}
              {renderNavRow(item)}
            </li>
          ))}
        </ul>
        <div className="mx-4 border-t border-[var(--color-outline-variant)]" />
        <button
          type="button"
          className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-[var(--color-error-container)]/15"
          onClick={() => void signOutAndRedirect()}
        >
          <span
            className="material-symbols-outlined leading-none"
            style={{ fontSize: 22, color: 'var(--color-error)' }}
          >
            logout
          </span>
          <span className="text-sm font-bold tracking-tight text-[var(--color-error)]">Log out</span>
        </button>
      </div>
    </div>
  );
}

function BottomBarItem({ item, active, pathname, onMoreClick }) {
  if (item.isMore) {
    return (
      <button
        type="button"
        onClick={onMoreClick}
        className="flex flex-1 flex-col items-center justify-center gap-1 py-2 min-w-0"
        aria-expanded={active}
        aria-haspopup="dialog"
      >
        <NavIcon icon={item.icon} active={active} />
        <span
          className="text-[10px] font-bold uppercase tracking-wide truncate max-w-full px-1"
          style={{
            color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
          }}
        >
          {item.label}
        </span>
      </button>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === '/dashboard/wellness' || item.to === '/athlete-home'}
      className="flex flex-1 flex-col items-center justify-center gap-1 py-2 min-w-0"
    >
      {({ isActive }) => {
        const routeActive = item.to === '/log' ? isRouteActive(pathname, '/log') : isActive;
        return (
          <>
            <NavIcon icon={item.icon} active={routeActive} />
            <span
              className="text-[10px] font-bold uppercase tracking-wide truncate max-w-full px-1"
              style={{
                color: routeActive ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
              }}
            >
              {item.label}
            </span>
          </>
        );
      }}
    </NavLink>
  );
}

export default function BottomNav({ variant = 'staff' }) {
  const { user } = useUser();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isStaff = variant === 'staff';
  const barItems = useMemo(
    () => (isStaff ? filterStaffItems(STAFF_BOTTOM_NAV, user) : ATHLETE_BOTTOM_NAV),
    [isStaff, user],
  );
  const moreItems = useMemo(
    () => (isStaff ? filterStaffItems(STAFF_MORE_NAV, user) : ATHLETE_MORE_NAV),
    [isStaff, user],
  );
  const planItems = useMemo(
    () => (isStaff ? filterStaffItems(STAFF_PLAN_NAV, user) : []),
    [isStaff, user],
  );
  const dashboardItems = useMemo(
    () =>
      isStaff
        ? STAFF_DASHBOARD_NAV.filter((item) => isDashboardSubRouteVisible(user, item.to))
        : [],
    [isStaff, user],
  );
  const logItems = useMemo(
    () => (isStaff ? STAFF_LOG_NAV.filter((item) => isLogSubRouteVisible(user, item.to)) : []),
    [isStaff, user],
  );
  const showPlanSection = isStaff && isNavRouteVisible(user, '/periodisation');
  const showDashboardSection = isStaff && isNavRouteVisible(user, '/dashboard');
  const showLogSection = isStaff && isNavRouteVisible(user, '/log');

  const moreActive =
    moreOpen ||
    moreItems.some((item) => isRouteActive(pathname, item.to)) ||
    planItems.some((item) => isRouteActive(pathname, item.to)) ||
    dashboardItems.some((item) => isRouteActive(pathname, item.to)) ||
    logItems.some((item) => isRouteActive(pathname, item.to));

  const barWithMore = [
    ...barItems,
    { icon: 'more_horiz', label: 'More', isMore: true },
  ];

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <>
      <MoreSheet
        open={moreOpen}
        items={moreItems}
        planItems={planItems}
        dashboardItems={dashboardItems}
        logItems={logItems}
        showPlanSection={showPlanSection}
        showDashboardSection={showDashboardSection}
        showLogSection={showLogSection}
        onClose={() => setMoreOpen(false)}
        pathname={pathname}
        user={user}
      />
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t-[0.5px] border-[var(--color-outline-variant)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {barWithMore.map((item) => (
            <BottomBarItem
              key={item.label}
              item={item}
              pathname={pathname}
              active={item.isMore ? moreActive : false}
              onMoreClick={() => setMoreOpen(true)}
            />
          ))}
        </div>
      </nav>
    </>
  );
}
