import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setMessage('Check your email for a password reset link');
    } catch (err) {
      setError(err.message || 'Unable to send reset link.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') handleReset();
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
            Reset Password
          </h1>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
            Enter your invited email address to receive a reset link.
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

            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="w-full rounded-xl bg-[var(--color-primary-container)] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--color-on-primary)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>

          {message && (
            <p className="mt-4 rounded-xl bg-[var(--color-tertiary-container)]/15 px-4 py-3 text-sm text-[var(--color-tertiary)]">
              {message}
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-xl bg-[var(--color-error-container)]/20 px-4 py-3 text-sm text-[var(--color-error)]">
              {error}
            </p>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-primary)] hover:text-[var(--color-primary-container)]"
            >
              Back to login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
