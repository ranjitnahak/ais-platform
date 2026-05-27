import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

const EXPIRED_LINK_MESSAGE =
  'This link has expired or is invalid. Please contact your administrator to resend your invite.';

function parseHashParams() {
  const hash = window.location.hash;
  if (!hash) return new URLSearchParams();
  return new URLSearchParams(hash.replace('#', '?'));
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('loading');
  const [tokenType, setTokenType] = useState(null);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const params = parseHashParams();
    const hashError = params.get('error');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');

    if (hashError) {
      if (mounted) setMode('token_error');
      return;
    }

    if (!accessToken) {
      if (mounted) setMode('email_request');
      return;
    }

    async function initSession() {
      setLoading(true);
      try {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? '',
        });
        if (sessionError) throw sessionError;
        if (!mounted) return;
        setTokenType(type);
        setMode('set_password');
        window.history.replaceState(null, '', window.location.pathname);
      } catch (err) {
        console.error('[ResetPassword] setSession', err);
        if (mounted) {
          setError(err.message || 'Could not validate link.');
          setMode('token_error');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void initSession();
    return () => {
      mounted = false;
    };
  }, []);

  const isInvite = tokenType === 'invite';
  const passwordHeading = isInvite ? 'Set your password' : 'Reset your password';
  const passwordSubmitLabel = isInvite ? 'Set Password' : 'Reset Password';

  async function handleResetEmail() {
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) throw resetError;
      setMessage('Check your email for a password reset link');
    } catch (err) {
      setError(err.message || 'Unable to send reset link.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword() {
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      const user = await getCurrentUser();
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }
      if (user.role?.toLowerCase() === 'athlete') {
        navigate('/athlete-home', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Could not update password.');
    } finally {
      setLoading(false);
    }
  }

  function handleEmailKeyDown(event) {
    if (event.key === 'Enter') handleResetEmail();
  }

  function handlePasswordKeyDown(event) {
    if (event.key === 'Enter') handleSetPassword();
  }

  if (mode === 'loading') {
    return (
      <main className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary-container)] border-t-transparent animate-spin" />
      </main>
    );
  }

  if (mode === 'token_error') {
    return (
      <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-on-background)] font-['Inter'] flex items-center justify-center px-5 py-10">
        <section className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-container)] text-[var(--color-on-primary)] text-lg font-black tracking-tighter">
              AIS
            </div>
            <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.05em] text-[var(--color-on-surface)]">
              Link expired
            </h1>
          </div>
          <div className="rounded-3xl bg-[var(--color-surface-container-low)] p-6 shadow-2xl ring-1 ring-[var(--color-outline-variant)] sm:p-8">
            <p className="rounded-xl bg-[var(--color-error-container)]/20 px-4 py-3 text-sm text-[var(--color-error)]">
              {error || EXPIRED_LINK_MESSAGE}
            </p>
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

  if (mode === 'set_password') {
    return (
      <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-on-background)] font-['Inter'] flex items-center justify-center px-5 py-10">
        <section className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-container)] text-[var(--color-on-primary)] text-lg font-black tracking-tighter">
              AIS
            </div>
            <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.05em] text-[var(--color-on-surface)]">
              {passwordHeading}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
              Choose a secure password for your account.
            </p>
          </div>

          <div className="rounded-3xl bg-[var(--color-surface-container-low)] p-6 shadow-2xl ring-1 ring-[var(--color-outline-variant)] sm:p-8">
            {error && (
              <p className="mb-4 rounded-xl bg-[var(--color-error-container)]/20 px-4 py-3 text-sm text-[var(--color-error)]">
                {error}
              </p>
            )}

            <div className="space-y-4" onKeyDown={handlePasswordKeyDown}>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-outline)]">
                  New password
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-3 text-sm text-[var(--color-on-surface)] outline-none transition focus:border-[var(--color-primary-container)]"
                  placeholder="At least 8 characters"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-outline)]">
                  Confirm password
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-3 text-sm text-[var(--color-on-surface)] outline-none transition focus:border-[var(--color-primary-container)]"
                  placeholder="Re-enter your password"
                />
              </label>

              <button
                type="button"
                onClick={handleSetPassword}
                disabled={loading}
                className="w-full rounded-xl bg-[var(--color-primary-container)] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--color-on-primary)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Saving...' : passwordSubmitLabel}
              </button>
            </div>
          </div>
        </section>
      </main>
    );
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
          <div className="space-y-4" onKeyDown={handleEmailKeyDown}>
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
              onClick={handleResetEmail}
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
