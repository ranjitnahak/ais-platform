import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import {
  getResetPasswordRedirectUrl,
  consumePendingPasswordReset,
  cameFromSupabaseAuthVerify,
  isVoluntaryForgotPasswordVisit,
} from '../lib/authRedirect';

const EXPIRED_LINK_MESSAGE =
  'This link has expired or is invalid. Please contact your administrator to resend your invite.';

const ACCOUNT_SETUP_MESSAGE =
  'Account setup incomplete. Please contact your administrator.';

const ACCOUNT_DEACTIVATED_AFTER_RESET_MESSAGE =
  'Your password was updated, but your account has been deactivated. Please contact your administrator.';

const RESET_EMAIL_SUCCESS_MESSAGE =
  "If an account exists for that email, we've sent a password reset link.";

function parseHashParams() {
  const hash = window.location.hash;
  if (!hash) return new URLSearchParams();
  return new URLSearchParams(hash.replace('#', '?'));
}

function looksLikeJwt(token) {
  return typeof token === 'string' && token.split('.').length === 3;
}

function looksLikeTokenHash(token) {
  return typeof token === 'string' && /^[a-f0-9]{40,}$/i.test(token);
}

function waitForAuthSession(timeoutMs = 5000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      clearTimeout(timer);
      resolve(result);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        finish({ event, session });
        return;
      }
      if (event === 'INITIAL_SESSION') {
        finish({ event, session });
      }
    });

    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      finish({ event: 'TIMEOUT', session: data.session });
    }, timeoutMs);
  });
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const voluntaryForgotPassword = location.state?.voluntaryForgotPassword === true;
  const [mode, setMode] = useState('loading');
  const [tokenType, setTokenType] = useState(null);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const recoveryDetectedRef = useRef(false);
  const expectPasswordResetRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    expectPasswordResetRef.current =
      consumePendingPasswordReset() || cameFromSupabaseAuthVerify();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        recoveryDetectedRef.current = true;
        setTokenType('recovery');
        setMode('set_password');
        return;
      }
      if (
        session &&
        expectPasswordResetRef.current &&
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
      ) {
        expectPasswordResetRef.current = false;
        setTokenType('recovery');
        setMode('set_password');
      }
    });
    const params = parseHashParams();
    const queryParams = new URLSearchParams(window.location.search);
    const hashError = params.get('error');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');
    const queryCode = queryParams.get('code');
    const queryType = queryParams.get('type');

    if (hashError) {
      if (mounted) setMode('token_error');
      return;
    }

    async function initSession() {
      setLoading(true);
      try {
        const hashTokenHash = params.get('token_hash');
        const queryTokenHash = queryParams.get('token_hash');
        const tokenHash =
          hashTokenHash ||
          queryTokenHash ||
          (looksLikeTokenHash(refreshToken) ? refreshToken : null);
        const otpType = type || queryType || 'recovery';

        if (queryCode) {
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(queryCode);
          if (codeError) throw codeError;
        } else {
          if (tokenHash && (!accessToken || !looksLikeJwt(accessToken))) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: otpType,
            });
            if (verifyError) throw verifyError;
          } else if (accessToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken ?? '',
            });
            if (sessionError) throw sessionError;
          } else {
            const pendingFromEmailLink = expectPasswordResetRef.current;
            if (pendingFromEmailLink) {
              const { event, session } = await waitForAuthSession();
              if (!mounted) return;
              if (session) {
                expectPasswordResetRef.current = false;
                setTokenType(type || queryType || 'recovery');
                setMode('set_password');
                window.history.replaceState(null, '', window.location.pathname);
                return;
              }
              if (!mounted) return;
              expectPasswordResetRef.current = false;
              setError(EXPIRED_LINK_MESSAGE);
              setMode('token_error');
              return;
            }

            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session) {
              await new Promise((resolve) => {
                queueMicrotask(resolve);
              });
              if (!mounted) return;
              if (recoveryDetectedRef.current || expectPasswordResetRef.current) {
                setTokenType('recovery');
                setMode('set_password');
                window.history.replaceState(null, '', window.location.pathname);
                return;
              }
              const shouldSignOutForEmailForm =
                voluntaryForgotPassword || isVoluntaryForgotPasswordVisit();
              if (shouldSignOutForEmailForm) {
                await supabase.auth.signOut();
                if (mounted) setMode('email_request');
                return;
              }
              setTokenType('recovery');
              setMode('set_password');
              window.history.replaceState(null, '', window.location.pathname);
              return;
            }

            const { event, session } = await waitForAuthSession(3000);
            if (!mounted) return;
            if (session && !voluntaryForgotPassword && !isVoluntaryForgotPasswordVisit()) {
              setTokenType('recovery');
              setMode('set_password');
              window.history.replaceState(null, '', window.location.pathname);
              return;
            }
            if (mounted) setMode('email_request');
            return;
          }
        }
        if (!mounted) return;
        setTokenType(type || queryType || 'recovery');
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
      subscription.unsubscribe();
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
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getResetPasswordRedirectUrl(),
      });
      if (resetError) throw resetError;
      setMessage(RESET_EMAIL_SUCCESS_MESSAGE);
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

      const { data: sessionData } = await supabase.auth.getSession();
      const authId = sessionData.session?.user?.id;

      if (isInvite && authId) {
        await supabase
          .from('users')
          .update({ is_active: true, deactivated_at: null })
          .eq('auth_id', authId);
      }

      if (authId) {
        const { data: profileRow } = await supabase
          .from('users')
          .select('is_active')
          .eq('auth_id', authId)
          .maybeSingle();

        if (!profileRow) {
          await supabase.auth.signOut();
          navigate('/login', { replace: true, state: { message: ACCOUNT_SETUP_MESSAGE } });
          return;
        }

        if (profileRow.is_active === false) {
          await supabase.auth.signOut();
          navigate('/login', {
            replace: true,
            state: { message: ACCOUNT_DEACTIVATED_AFTER_RESET_MESSAGE },
          });
          return;
        }
      }

      const user = await getCurrentUser();
      if (!user) {
        await supabase.auth.signOut();
        navigate('/login', { replace: true, state: { message: ACCOUNT_SETUP_MESSAGE } });
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
            Enter the email address for your account.
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
