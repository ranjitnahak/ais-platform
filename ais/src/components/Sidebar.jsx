import { NavLink } from 'react-router-dom';
import { MAIN_NAV_ITEMS, SUPERUSER_NAV_ITEM } from '../nav/mainNavItems';
import { useUser } from '../context/UserContext';
import { filterStaffNavItems } from '../nav/navResourceMap';

const ADMIN_ROLES = ['admin', 'superuser'];

/**
 * Desktop primary navigation — matches AIS shell used across pages.
 */
export default function Sidebar() {
  const { user } = useUser();
  const items = filterStaffNavItems(
    MAIN_NAV_ITEMS.filter((item) => !item.adminOnly || ADMIN_ROLES.includes(user?.role)),
    user,
  );
  const visibleItems = user?.role === 'superuser' ? [...items, SUPERUSER_NAV_ITEM] : items;

  return (
    <aside className="hidden lg:flex flex-col h-full w-64 fixed left-0 top-0 bg-[var(--color-surface)] border-r border-[var(--color-outline-variant)] shadow-2xl py-6 z-50">
      <div className="px-6 mb-10">
        <span className="text-2xl font-black tracking-tighter text-[var(--color-on-surface)] uppercase">AIS</span>
      </div>
      <nav className="flex-1 space-y-1">
        {visibleItems.map(({ icon, label, to }) => (
          <NavLink
            key={label}
            to={to}
            className={({ isActive }) =>
              `w-full mx-2 my-1 px-4 py-3 flex items-center gap-3 transition-colors rounded-lg text-left ${
                isActive
                  ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)] active:scale-95 duration-200'
                  : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]'
              }`
            }
          >
            <span className="material-symbols-outlined">{icon}</span>
            <span className="font-['Inter'] tracking-tight font-bold uppercase text-[10px]">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
