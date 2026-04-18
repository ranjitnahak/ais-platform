import { NavLink } from 'react-router-dom';
import { MAIN_NAV_ITEMS } from '../nav/mainNavItems';

/**
 * Desktop primary navigation — matches AIS shell used across pages.
 */
export default function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col h-full w-64 fixed left-0 top-0 bg-[#131315] border-r border-white/5 shadow-2xl py-6 z-50">
      <div className="px-6 mb-10">
        <span className="text-2xl font-black tracking-tighter text-white uppercase">AIS</span>
      </div>
      <nav className="flex-1 space-y-1">
        {MAIN_NAV_ITEMS.map(({ icon, label, to }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `w-full mx-2 my-1 px-4 py-3 flex items-center gap-3 transition-colors rounded-lg text-left ${
                isActive
                  ? 'bg-[#F97316] text-white active:scale-95 duration-200'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
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
