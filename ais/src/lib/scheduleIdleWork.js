const IDLE_TIMEOUT_MS = 2000;

/**
 * Runs work when the browser is idle, with setTimeout fallback.
 */
export function scheduleIdleWork(callback) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  if (typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = window.setTimeout(callback, 1);
  return () => window.clearTimeout(timeoutId);
}
