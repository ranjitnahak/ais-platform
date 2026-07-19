import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { getUserAccountLabels, signOutAndRedirect } from '../../lib/authSession';
import {
  STAFF_BOTTOM_NAV,
  STAFF_MORE_NAV,
  STAFF_DASHBOARD_NAV,
  STAFF_PLAN_NAV,
  STAFF_LOG_NAV,
  ATHLETE_BOTTOM_NAV,
  ATHLETE_MORE_NAV,
} from '../../nav/mobileNavItems';
import {
  filterStaffNavItems,
  isDashboardSubRouteVisible,
  isLogSubRouteVisible,
} from '../../nav/navResourceMap';
import NavPicker from './NavPicker';

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
  if (to === '/dashboard') {
    return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  }
  if (to === '/plan') {
    return (
      pathname === '/plan' ||
      pathname === '/periodisation' ||
      pathname.startsWith('/periodisation/') ||
      pathname === '/plan/calendar' ||
      pathname.startsWith('/plan/')
    );
  }
  if (to === '/log') {
    return pathname === '/log' || pathname.startsWith('/log/');
  }
  if (to === '/athlete-home') {
    return pathname === to;
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

function NavSheet({ open, title, items, onClose, pathname, header, footer, ariaLabel }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="presentation">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] bg-black/50"
        onClick={onClose}
      />
      <div
        className="absolute left-0 right-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] flex max-h-[calc(100dvh-5.5rem-3.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-t-2xl border-t border-[var(--color-outline-variant)] bg-[var(--color-surface)]"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
      >
        <div className="flex shrink-0 justify-center pt-3 pb-2">
          <span className="h-1 w-10 rounded-full bg-[var(--color-outline-variant)]" aria-hidden />
        </div>
        {header}
        {title && !header ? (
          <p className="shrink-0 px-6 pb-2 text-sm font-bold text-[var(--color-on-surface)]">{title}</p>
        ) : null}
        {(header || title) && (
          <div className="mx-4 shrink-0 border-t border-[var(--color-outline-variant)]" />
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavPicker
            items={items}
            compact
            isActive={(item) => isRouteActive(pathname, item.to)}
            onNavigate={onClose}
            footer={footer}
          />
        </div>
      </div>
    </div>
  );
}

function BottomBarItem({ item, active, pathname, onSheetClick }) {
  if (item.sheetId || item.isMore) {
    const sheetId = item.sheetId ?? 'more';
    return (
      <button
        type="button"
        onClick={() => onSheetClick(sheetId)}
        className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2"
        aria-expanded={active}
        aria-haspopup="dialog"
      >
        <NavIcon icon={item.icon} active={active} />
        <span
          className="max-w-full truncate px-1 text-[10px] font-bold uppercase tracking-wide"
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
      className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2"
    >
      {() => {
        const routeActive = isRouteActive(pathname, item.to);
        return (
          <>
            <NavIcon icon={item.icon} active={routeActive} />
            <span
              className="max-w-full truncate px-1 text-[10px] font-bold uppercase tracking-wide"
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
  const [openSheet, setOpenSheet] = useState(null);

  const isStaff = variant === 'staff';
  const barItems = useMemo(
    () => (isStaff ? filterStaffItems(STAFF_BOTTOM_NAV, user) : ATHLETE_BOTTOM_NAV),
    [isStaff, user],
  );
  const moreItems = useMemo(
    () => (isStaff ? filterStaffItems(STAFF_MORE_NAV, user) : ATHLETE_MORE_NAV),
    [isStaff, user],
  );
  const dashboardItems = useMemo(
    () =>
      isStaff
        ? STAFF_DASHBOARD_NAV.filter((item) => isDashboardSubRouteVisible(user, item.to))
        : [],
    [isStaff, user],
  );
  const planItems = useMemo(
    () => (isStaff ? filterStaffItems(STAFF_PLAN_NAV, user) : []),
    [isStaff, user],
  );
  const logItems = useMemo(
    () => (isStaff ? STAFF_LOG_NAV.filter((item) => isLogSubRouteVisible(user, item.to)) : []),
    [isStaff, user],
  );

  const { displayName, roleLabel } = getUserAccountLabels(user);

  const moreHeader = (
    <div className="flex shrink-0 items-center gap-4 px-6 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] text-[var(--color-outline)]">
        <span className="material-symbols-outlined text-lg">person</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[var(--color-on-surface)]">{displayName}</p>
        <p className="mt-0.5 truncate text-xs text-[var(--color-on-surface-variant)]">{roleLabel}</p>
      </div>
    </div>
  );

  const logoutFooter = (
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
  );

  const sheetConfig = {
    dashboard: { title: 'Dashboard', items: dashboardItems, ariaLabel: 'Dashboard navigation' },
    plan: { title: 'Plan', items: planItems, ariaLabel: 'Plan navigation' },
    log: { title: 'Log', items: logItems, ariaLabel: 'Log navigation' },
    more: {
      title: null,
      items: moreItems,
      header: moreHeader,
      footer: logoutFooter,
      ariaLabel: 'More navigation',
    },
  };

  const barWithMore = [
    ...barItems,
    { icon: 'more_horiz', label: 'More', sheetId: 'more', to: '/reports' },
  ];

  const isBarItemActive = (item) => {
    if (item.sheetId) {
      if (openSheet === item.sheetId) return true;
      if (item.sheetId === 'more') {
        return moreItems.some((m) => isRouteActive(pathname, m.to));
      }
      return isRouteActive(pathname, item.to);
    }
    return false;
  };

  useEffect(() => {
    setOpenSheet(null);
  }, [pathname]);

  const activeSheet = openSheet ? sheetConfig[openSheet] : null;

  return (
    <>
      <NavSheet
        open={!!activeSheet}
        title={activeSheet?.title}
        items={activeSheet?.items ?? []}
        header={activeSheet?.header}
        footer={activeSheet?.footer}
        ariaLabel={activeSheet?.ariaLabel}
        onClose={() => setOpenSheet(null)}
        pathname={pathname}
      />
      <nav
        className="fixed bottom-0 left-0 right-0 z-[70] border-t-[0.5px] border-[var(--color-outline-variant)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {barWithMore.map((item) => (
            <BottomBarItem
              key={item.label}
              item={item}
              pathname={pathname}
              active={isBarItemActive(item)}
              onSheetClick={(id) => setOpenSheet((prev) => (prev === id ? null : id))}
            />
          ))}
        </div>
      </nav>
    </>
  );
}
