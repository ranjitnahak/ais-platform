import AISLogo from './AISLogo';
import { formatRoleOrPosition } from '../../lib/adminUserConstants';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour <= 11) return 'Good morning';
  if (hour >= 12 && hour <= 16) return 'Good afternoon';
  return 'Good evening';
}

function buildSubtitle(user) {
  const isAthlete = user?.role?.toLowerCase() === 'athlete';
  if (isAthlete) {
    const position = user?.position ? formatRoleOrPosition(user.position) : null;
    const team = user?.teamName?.trim() || null;
    if (position && team) return `${position} · ${team}`;
    return user?.orgName?.trim() || '—';
  }
  const role = user?.roleLabel || formatRoleOrPosition(user?.role);
  const org = user?.orgName?.trim() || null;
  if (role && org && role !== '—') return `${role} · ${org}`;
  return org || '—';
}

export function HeaderBrandMark({ user, size = 32, className = '' }) {
  const logoUrl = user?.orgLogoUrl?.trim() || null;

  return (
    <div className={`shrink-0 ${className}`.trim()}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={user?.orgName ? `${user.orgName} logo` : 'Organisation logo'}
          className="h-9 w-9 rounded-lg object-cover"
        />
      ) : (
        <AISLogo size={size} />
      )}
    </div>
  );
}

export default function PersonalisedHeader({ user, showLogo = true }) {
  const displayName = user?.fullName?.trim() || 'Signed in user';
  const subtitle = buildSubtitle(user);

  return (
    <header className={showLogo ? 'flex items-start justify-between gap-4' : undefined}>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-[var(--color-on-surface-variant)]">{getGreeting()}</p>
        <h1 className="mt-0.5 truncate text-[15px] font-medium text-[var(--color-on-surface)]">{displayName}</h1>
        <p className="mt-0.5 truncate text-[11px] text-[var(--color-on-surface-variant)]">{subtitle}</p>
      </div>
      {showLogo && <HeaderBrandMark user={user} />}
    </header>
  );
}
