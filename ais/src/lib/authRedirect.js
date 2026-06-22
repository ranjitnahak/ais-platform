const PENDING_PASSWORD_RESET_KEY = 'ais_pending_password_reset';
const AUTH_CALLBACK_STORAGE_KEY = 'ais_auth_callback';

export function hasAuthCallbackInUrl(search, hash) {
  const searchParams = new URLSearchParams(search);
  if (searchParams.has('code') || searchParams.has('token_hash')) return true;
  if (!hash) return false;
  const hashParams = new URLSearchParams(hash.replace('#', '?'));
  if (hashParams.has('access_token')) return true;
  const type = hashParams.get('type');
  return type === 'recovery' || type === 'invite';
}

export function getResetPasswordRedirectUrl() {
  return `${window.location.origin}/reset-password`;
}

export function storeAuthCallback(search, hash) {
  if (typeof window === 'undefined') return;
  const suffix = `${search || ''}${hash || ''}`;
  if (!suffix) return;
  sessionStorage.setItem(AUTH_CALLBACK_STORAGE_KEY, suffix);
}

export function getStoredAuthCallback() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(AUTH_CALLBACK_STORAGE_KEY);
}

export function clearStoredAuthCallback() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTH_CALLBACK_STORAGE_KEY);
}

/** Resolve auth query/hash from URL or sessionStorage fallback (survives StrictMode remounts). */
export function resolveAuthCallbackParts(search, hash) {
  if (hasAuthCallbackInUrl(search, hash)) {
    return { search: search || '', hash: hash || '' };
  }

  const stored = getStoredAuthCallback();
  if (!stored) {
    return { search: search || '', hash: hash || '' };
  }

  const hashIdx = stored.indexOf('#');
  if (hashIdx >= 0) {
    return {
      search: hashIdx > 0 ? stored.slice(0, hashIdx) : '',
      hash: stored.slice(hashIdx),
    };
  }

  const queryIdx = stored.indexOf('?');
  if (queryIdx >= 0) {
    return { search: stored.slice(queryIdx), hash: '' };
  }

  return { search: search || '', hash: hash || '' };
}

export function markPendingPasswordReset(search = '', hash = '') {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PENDING_PASSWORD_RESET_KEY, '1');
  storeAuthCallback(search, hash);
}

export function peekPendingPasswordReset() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(PENDING_PASSWORD_RESET_KEY) === '1';
}

export function clearPendingPasswordReset() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(PENDING_PASSWORD_RESET_KEY);
}

export function cameFromSupabaseAuthVerify() {
  if (typeof document === 'undefined') return false;
  try {
    return document.referrer.includes('/auth/v1/verify');
  } catch {
    return false;
  }
}

export function isVoluntaryForgotPasswordVisit() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  try {
    const ref = document.referrer;
    if (!ref) return false;
    const refUrl = new URL(ref);
    return refUrl.origin === window.location.origin && refUrl.pathname === '/login';
  } catch {
    return false;
  }
}

export function isEmailRecoveryVisit(search, hash) {
  return (
    hasAuthCallbackInUrl(search, hash) ||
    Boolean(getStoredAuthCallback()) ||
    peekPendingPasswordReset() ||
    cameFromSupabaseAuthVerify()
  );
}

/** Run before Supabase createClient so detectSessionInUrl does not consume tokens on `/`. */
export function redirectAuthCallbackToResetPassword() {
  if (typeof window === 'undefined') return false;

  const { pathname, search, hash, origin } = window.location;
  const hasCallback = hasAuthCallbackInUrl(search, hash);

  if (hasCallback) {
    markPendingPasswordReset(search, hash);
  }

  if (pathname === '/reset-password') {
    return false;
  }

  if (!hasCallback) return false;

  const target = `${origin}/reset-password${search}${hash}`;
  window.location.replace(target);
  return true;
}
