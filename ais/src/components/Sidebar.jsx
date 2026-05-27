import { NavLink } from 'react-router-dom';
import { MAIN_NAV_ITEMS } from '../nav/mainNavItems';
import { useUser } from '../context/UserContext';

const ADMIN_NAV_ITEM = { icon: 'admin_panel_settings', label: 'Admin', to: '/admin' };
const SUPERUSER_NAV_ITEM = { icon: 'shield', label: 'Superuser', to: '/superuser' };
const WELLNESS_NAV_ITEM = { icon: 'favorite', label: 'Wellness', to: '/wellness' };
const STAFF_NOTES_NAV_ITEM = { icon: 'clinical_notes', label: 'Staff Notes', to: '/staff-notes' };
const ADMIN_ROLES = ['admin', 'superuser'];
const STAFF_NOTES_ROLES = ['admin', 'superuser', 'head coach', 's&c coach', 'physio', 'analyst', 'nutritionist'];

/**
 * Desktop primary navigation — matches AIS shell used across pages.
 */
export default function Sidebar() {
  const { user } = useUser();
  const baseItems = user?.role && user.role?.toLowerCase() !== 'athlete'
    ? [...MAIN_NAV_ITEMS, WELLNESS_NAV_ITEM]
    : MAIN_NAV_ITEMS;
  const staffItems = STAFF_NOTES_ROLES.includes(user?.role)
    ? [...baseItems, STAFF_NOTES_NAV_ITEM]
    : baseItems;
  const items = ADMIN_ROLES.includes(user?.role)
    ? [...staffItems, ADMIN_NAV_ITEM]
    : staffItems;
  const visibleItems = user?.role === 'superuser'
    ? [...items, SUPERUSER_NAV_ITEM]
    : items;

  return (
    <aside className="hidden md:flex flex-col h-full w-64 fixed left-0 top-0 bg-[var(--color-surface)] border-r border-[var(--color-outline-variant)] shadow-2xl py-6 z-50">
      <div className="px-6 mb-10">
        <span className="text-2xl font-black tracking-tighter text-[var(--color-on-surface)] uppercase">AIS</span>
      </div>
      <nav className="flex-1 space-y-1">
        {visibleItems.map(({ icon, label, to }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
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
