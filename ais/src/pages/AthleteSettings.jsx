import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AthleteSettings() {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('[AthleteSettings] logout', err);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">Settings</p>
      <h1 className="mt-2 text-xl font-black text-[var(--color-on-surface)]">Account</h1>
      <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
        Manage your athlete account preferences.
      </p>
      <button
        type="button"
        onClick={handleLogout}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-outline-variant)] px-4 py-3 text-sm font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)] transition-colors hover:bg-[var(--color-surface-container-high)] hover:text-[var(--color-on-surface)]"
      >
        <span className="material-symbols-outlined text-lg">logout</span>
        Sign out
      </button>
    </div>
  );
}
