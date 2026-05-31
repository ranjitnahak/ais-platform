/** Production origin for share links and external references. */
export const CANONICAL_SITE_ORIGIN = 'https://app.athleteintelligencesystem.in';

/** Origin for shareable links — canonical in prod, localhost when developing. */
export function shareOrigin() {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (host === 'localhost' || host === '127.0.0.1') {
    return window.location.origin;
  }
  return CANONICAL_SITE_ORIGIN;
}
