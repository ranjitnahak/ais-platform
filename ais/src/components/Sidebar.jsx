import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MAIN_NAV_ITEMS, SUPERUSER_NAV_ITEM } from '../nav/mainNavItems';
import { DASHBOARD_SUB_ITEMS } from '../nav/dashboardNavItems';
import { LOG_SUB_ITEMS } from '../nav/logNavItems';
import { useUser } from '../context/UserContext';
import { filterStaffNavItems, isDashboardSubRouteVisible, isLogSubRouteVisible, isNavRouteVisible } from '../nav/navResourceMap';
import AISLogo from './shared/AISLogo';

const ADMIN_ROLES = ['admin', 'superuser'];

const PLAN_SUB_ITEMS = [
  { label: 'Periodisation', to: '/periodisation', icon: 'ti-layout-rows' },
  { label: 'Calendar', to: '/plan/calendar', icon: 'ti-calendar-week' },
];

const navLinkClass = (isActive) =>
  `w-full mx-2 my-1 px-4 py-3 flex items-center gap-3 transition-colors rounded-lg text-left ${
    isActive
      ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)] active:scale-95 duration-200'
      : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]'
  }`;

const subNavLinkClass = (isActive) =>
  `w-full mx-2 my-0.5 flex items-center gap-3 transition-colors rounded-lg text-left py-2.5 pr-4 ${
    isActive
      ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
      : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]'
  }`;

function isPlanSubActive(pathname, to) {
  if (to === '/periodisation') return pathname === '/periodisation';
  return pathname === to || pathname.startsWith(`${to}/`);
}

function isDashboardSubActive(pathname, to) {
  return pathname === to;
}

function isDashboardGroupActive(pathname) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

function isLogGroupActive(pathname) {
  return pathname === '/log' || pathname.startsWith('/log/');
}

function isLogSubActive(pathname, to) {
  return pathname === to;
}

/**
 * Desktop primary navigation — matches AIS shell used across pages.
 */
export default function Sidebar() {
  const { user } = useUser();
  const { pathname } = useLocation();
  const [planOpen, setPlanOpen] = useState(true);
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [logOpen, setLogOpen] = useState(true);

  const items = filterStaffNavItems(
    MAIN_NAV_ITEMS.filter((item) => !item.adminOnly || ADMIN_ROLES.includes(user?.role)),
    user,
  );
  const visibleItems = user?.role === 'superuser' ? [...items, SUPERUSER_NAV_ITEM] : items;
  const showPlanGroup = isNavRouteVisible(user, '/periodisation');
  const showDashboardGroup = isNavRouteVisible(user, '/dashboard');
  const showLogGroup = isNavRouteVisible(user, '/log');
  const visibleDashboardItems = DASHBOARD_SUB_ITEMS.filter((sub) =>
    isDashboardSubRouteVisible(user, sub.to),
  );
  const visibleLogItems = LOG_SUB_ITEMS.filter((sub) => isLogSubRouteVisible(user, sub.to));

  useEffect(() => {
    if (pathname === '/periodisation' || pathname.startsWith('/plan/')) {
      setPlanOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (isDashboardGroupActive(pathname)) {
      setDashboardOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (isLogGroupActive(pathname)) {
      setLogOpen(true);
    }
  }, [pathname]);

  return (
    <aside className="hidden lg:flex flex-col h-full w-64 fixed left-0 top-0 bg-[var(--color-surface)] border-r border-[var(--color-outline-variant)] shadow-2xl py-6 z-50">
      <div className="px-6 mb-10">
        <AISLogo size={32} />
      </div>
      <nav className="flex-1 space-y-1">
        {visibleItems.map(({ icon, label, to }) => {
          if (to === '/dashboard') {
            if (!showDashboardGroup || visibleDashboardItems.length === 0) return null;
            return (
              <div key="dashboard-group">
                <button
                  type="button"
                  onClick={() => setDashboardOpen((v) => !v)}
                  className="w-full mx-2 my-1 px-4 py-3 flex items-center gap-3 rounded-lg text-left text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
                >
                  <span className="material-symbols-outlined text-[20px] leading-none shrink-0">dashboard</span>
                  <span className="font-['Inter'] tracking-tight font-bold uppercase text-[10px] flex-1">
                    DASHBOARD
                  </span>
                  <i
                    className={`ti ${dashboardOpen ? 'ti-chevron-down' : 'ti-chevron-right'} text-[16px] leading-none shrink-0`}
                    aria-hidden
                  />
                </button>
                {dashboardOpen &&
                  visibleDashboardItems.map((sub) => {
                    const active = isDashboardSubActive(pathname, sub.to);
                    return (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        className={subNavLinkClass(active)}
                        style={{ paddingLeft: 'calc(1rem + 20px + 1rem)' }}
                      >
                        <i className={`ti ${sub.icon} text-[16px] leading-none shrink-0`} aria-hidden />
                        <span className="font-['Inter'] tracking-tight font-bold uppercase text-[12px]">
                          {sub.label}
                        </span>
                      </NavLink>
                    );
                  })}
              </div>
            );
          }

          if (to === '/periodisation') {
            if (!showPlanGroup) return null;
            return (
              <div key="plan-group">
                <button
                  type="button"
                  onClick={() => setPlanOpen((v) => !v)}
                  className="w-full mx-2 my-1 px-4 py-3 flex items-center gap-3 rounded-lg text-left text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
                >
                  <i className="ti ti-map-2 text-[20px] leading-none shrink-0" aria-hidden />
                  <span className="font-['Inter'] tracking-tight font-bold uppercase text-[10px] flex-1">
                    PLAN
                  </span>
                  <i
                    className={`ti ${planOpen ? 'ti-chevron-down' : 'ti-chevron-right'} text-[16px] leading-none shrink-0`}
                    aria-hidden
                  />
                </button>
                {planOpen &&
                  PLAN_SUB_ITEMS.map((sub) => {
                    const active = isPlanSubActive(pathname, sub.to);
                    return (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        className={subNavLinkClass(active)}
                        style={{ paddingLeft: 'calc(1rem + 20px + 1rem)' }}
                      >
                        <i className={`ti ${sub.icon} text-[16px] leading-none shrink-0`} aria-hidden />
                        <span className="font-['Inter'] tracking-tight font-bold uppercase text-[12px]">
                          {sub.label}
                        </span>
                      </NavLink>
                    );
                  })}
              </div>
            );
          }

          if (to === '/log') {
            if (!showLogGroup || visibleLogItems.length === 0) return null;
            return (
              <div key="log-group">
                <button
                  type="button"
                  onClick={() => setLogOpen((v) => !v)}
                  className="w-full mx-2 my-1 px-4 py-3 flex items-center gap-3 rounded-lg text-left text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
                >
                  <span className="material-symbols-outlined text-[20px] leading-none shrink-0">edit_note</span>
                  <span className="font-['Inter'] tracking-tight font-bold uppercase text-[10px] flex-1">
                    LOG
                  </span>
                  <i
                    className={`ti ${logOpen ? 'ti-chevron-down' : 'ti-chevron-right'} text-[16px] leading-none shrink-0`}
                    aria-hidden
                  />
                </button>
                {logOpen &&
                  visibleLogItems.map((sub) => {
                    const active = isLogSubActive(pathname, sub.to);
                    return (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        className={subNavLinkClass(active)}
                        style={{ paddingLeft: 'calc(1rem + 20px + 1rem)' }}
                      >
                        <i className={`ti ${sub.icon} text-[16px] leading-none shrink-0`} aria-hidden />
                        <span className="font-['Inter'] tracking-tight font-bold uppercase text-[12px]">
                          {sub.label}
                        </span>
                      </NavLink>
                    );
                  })}
              </div>
            );
          }

          return (
            <NavLink key={label} to={to} className={({ isActive }) => navLinkClass(isActive)}>
              <span className="material-symbols-outlined">{icon}</span>
              <span className="font-['Inter'] tracking-tight font-bold uppercase text-[10px]">{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
