import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const NAV = [
  { to: '/athlete-home', icon: 'home', label: 'Home' },
  { to: '/athlete-data', icon: 'insights', label: 'My Data' },
  { to: '/athlete-profile', icon: 'person', label: 'Profile' },
];

export default function AthleteLayout({ children }) {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('[AthleteLayout] logout', err);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-on-surface)] font-['Inter']">
      <main className="px-4 pb-24 pt-10">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-4 py-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest ${
                  isActive
                    ? 'text-[var(--color-primary-container)]'
                    : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className="material-symbols-outlined"
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={handleLogout}
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

