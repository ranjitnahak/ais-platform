/** Session category visuals for weekly grid (soft fill + border). */

export const CAT_BORDER = {
  strength: 'var(--color-cat-strength)',
  speed: 'var(--color-cat-speed)',
  conditioning: 'var(--color-cat-conditioning)',
  recovery: 'var(--color-cat-recovery)',
  power: 'var(--color-cat-power)',
  mobility: 'var(--color-cat-mobility)',
  mixed: 'var(--color-cat-mixed)',
}

export const CAT_SOFT = {
  strength: { background: 'rgba(249, 115, 22, 0.15)', color: 'var(--color-cat-strength)' },
  speed: { background: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-cat-speed)' },
  conditioning: { background: 'rgba(6, 182, 212, 0.15)', color: 'var(--color-cat-conditioning)' },
  recovery: { background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-cat-recovery)' },
  power: { background: 'rgba(139, 92, 246, 0.15)', color: 'var(--color-cat-power)' },
  mobility: { background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-cat-mobility)' },
  mixed: { background: 'rgba(107, 114, 128, 0.15)', color: 'var(--color-cat-mixed)' },
}

export const SESSION_CATS = ['strength', 'speed', 'conditioning', 'recovery', 'power', 'mobility', 'mixed']

export const btnPrimary = {
  padding: '10px 16px',
  borderRadius: 'var(--radius-default)',
  border: 'none',
  background: 'var(--color-primary)',
  color: 'var(--color-text)',
  fontWeight: 'var(--font-weight-semibold)',
  cursor: 'pointer',
}

export const btnOutline = { ...btnPrimary, background: 'transparent', border: '1px solid var(--color-border)' }

export const badgeBase = {
  display: 'inline-block',
  padding: '4px 10px',
  borderRadius: 'var(--radius-full)',
  fontSize: 'var(--font-size-body-sm)',
  fontWeight: 'var(--font-weight-medium)',
  textTransform: 'capitalize',
}

export const badgePill = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 'var(--radius-full)',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
}

export const modalOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 150,
  padding: 24,
}

export const modalBox = {
  width: '100%',
  maxWidth: 420,
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-container)',
}

export const inp = {
  width: '100%',
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 'var(--radius-default)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-low)',
  color: 'var(--color-text)',
}
