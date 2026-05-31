import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { getUserAccountLabels, signOutAndRedirect } from '../../lib/authSession';
import {
  STAFF_BOTTOM_NAV,
  STAFF_MORE_NAV,
  ATHLETE_BOTTOM_NAV,
  ATHLETE_MORE_NAV,
} from '../../nav/mobileNavItems';
import { filterStaffNavItems } from '../../nav/navResourceMap';

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
  if (to === '/dashboard' || to === '/athlete-home') {
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

function MoreSheet({ open, items, onClose, pathname, user }) {
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
          {items.map((item, index) => {
            const active = isRouteActive(pathname, item.to);
            return (
              <li key={item.to}>
                {index > 0 && (
                  <div className="mx-4 border-t border-[var(--color-outline-variant)]" />
                )}
                <button
                  type="button"
                  className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-[var(--color-surface-container)]"
                  onClick={() => {
                    onClose();
                    navigate(item.to);
                  }}
                >
                  <NavIcon icon={item.icon} active={active} />
                  <span
                    className="text-sm font-bold tracking-tight"
                    style={{
                      color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
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

function BottomBarItem({ item, active, onMoreClick }) {
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
      end={item.to === '/dashboard' || item.to === '/athlete-home'}
      className="flex flex-1 flex-col items-center justify-center gap-1 py-2 min-w-0"
    >
      {({ isActive }) => (
        <>
          <NavIcon icon={item.icon} active={isActive} />
          <span
            className="text-[10px] font-bold uppercase tracking-wide truncate max-w-full px-1"
            style={{
              color: isActive ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
            }}
          >
            {item.label}
          </span>
        </>
      )}
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

  const moreActive =
    moreOpen || moreItems.some((item) => isRouteActive(pathname, item.to));

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
              active={item.isMore ? moreActive : false}
              onMoreClick={() => setMoreOpen(true)}
            />
          ))}
        </div>
      </nav>
    </>
  );
}
