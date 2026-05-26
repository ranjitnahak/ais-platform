import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/athletes');
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') handleSignIn();
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-on-background)] font-['Inter'] flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-container)] text-[var(--color-on-primary)] text-lg font-black tracking-tighter">
            AIS
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--color-outline)]">
            Athlete Intelligence System
          </p>
          <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.05em] text-[var(--color-on-surface)]">
            Sign In
          </h1>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
            Access is invite-only for organisation users.
          </p>
        </div>

        <div className="rounded-3xl bg-[var(--color-surface-container-low)] p-6 shadow-2xl ring-1 ring-[var(--color-outline-variant)] sm:p-8">
          <div className="space-y-4" onKeyDown={handleKeyDown}>
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-outline)]">
                Email
              </span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-3 text-sm text-[var(--color-on-surface)] outline-none transition focus:border-[var(--color-primary-container)]"
                placeholder="you@organisation.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-outline)]">
                Password
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-3 text-sm text-[var(--color-on-surface)] outline-none transition focus:border-[var(--color-primary-container)]"
                placeholder="Enter your password"
              />
            </label>

            <button
              type="button"
              onClick={handleSignIn}
              disabled={loading}
              className="w-full rounded-xl bg-[var(--color-primary-container)] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--color-on-primary)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-[var(--color-error-container)]/20 px-4 py-3 text-sm text-[var(--color-error)]">
              {error}
            </p>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/reset-password"
              className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-primary)] hover:text-[var(--color-primary-container)]"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
