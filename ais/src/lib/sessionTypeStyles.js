export const SESSION_TYPE_OPTIONS = [
  { label: 'Strength session', value: 'strength' },
  { label: 'Speed & agility', value: 'speed_agility' },
  { label: 'Recovery', value: 'recovery' },
  { label: 'Technical & Tactical', value: 'technical_tactical' },
  { label: 'Match', value: 'match' },
  { label: 'Other', value: 'other' },
];

export const SESSION_VENUES = ['Gym', 'Field', 'Pool', 'Track', 'Other'];

const SESSION_TYPE_STYLE_MAP = {
  conditioning: {
    bg: 'var(--session-speed-bg)',
    border: 'var(--session-speed-border)',
    text: 'var(--session-speed-text)',
  },
  mat: {
    bg: 'var(--session-technical-bg)',
    border: 'var(--session-technical-border)',
    text: 'var(--session-technical-text)',
  },
  physio: {
    bg: 'var(--session-recovery-bg)',
    border: 'var(--session-recovery-border)',
    text: 'var(--session-recovery-text)',
  },
  testing: {
    bg: 'var(--session-other-bg)',
    border: 'var(--session-other-border)',
    text: 'var(--session-other-text)',
  },
  strength: {
    bg: 'var(--session-strength-bg)',
    border: 'var(--session-strength-border)',
    text: 'var(--session-strength-text)',
  },
  recovery: {
    bg: 'var(--session-recovery-bg)',
    border: 'var(--session-recovery-border)',
    text: 'var(--session-recovery-text)',
  },
  speed_agility: {
    bg: 'var(--session-speed-bg)',
    border: 'var(--session-speed-border)',
    text: 'var(--session-speed-text)',
  },
  technical_tactical: {
    bg: 'var(--session-technical-bg)',
    border: 'var(--session-technical-border)',
    text: 'var(--session-technical-text)',
  },
  match: {
    bg: 'var(--session-match-bg)',
    border: 'var(--session-match-border)',
    text: 'var(--session-match-text)',
  },
  other: {
    bg: 'var(--session-other-bg)',
    border: 'var(--session-other-border)',
    text: 'var(--session-other-text)',
  },
};

export function sessionTypeLabel(value) {
  return SESSION_TYPE_OPTIONS.find((t) => t.value === value)?.label ?? 'Session';
}

export function sessionTypeStyles(sessionType) {
  return SESSION_TYPE_STYLE_MAP[sessionType] ?? SESSION_TYPE_STYLE_MAP.other;
}
