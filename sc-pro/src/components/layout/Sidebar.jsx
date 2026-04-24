import { NavLink } from 'react-router-dom'
import { getCurrentUser } from '../../lib/auth.js'

const nav = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/programmes', label: 'Programmes', icon: 'grid' },
  { to: '/athletes', label: 'Athletes', icon: 'people' },
  { to: '/analytics', label: 'Analytics', icon: 'chart' },
  { to: '/exercise-library', label: 'Exercise Library', icon: 'book' },
  { to: '/settings', label: 'Settings', icon: 'gear' },
]

function NavIcon({ name }) {
  const common = {
    width: 20,
    height: 20,
    flexShrink: 0,
    marginRight: 12,
    stroke: 'currentColor',
    fill: 'none',
    strokeWidth: 1.75,
  }
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" style={common} aria-hidden>
          <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
        </svg>
      )
    case 'grid':
      return (
        <svg viewBox="0 0 24 24" style={common} aria-hidden>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      )
    case 'people':
      return (
        <svg viewBox="0 0 24 24" style={common} aria-hidden>
          <path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3z" />
          <path d="M8 13c-2.7 0-5 1.3-5 3v2h10v-2c0-1.7-2.3-3-5-3zM16 13c-.3 0-.7 0-1 .1 1.2.5 2 1.4 2 2.9v2h5v-2c0-1.7-2.3-3-5-3z" />
        </svg>
      )
    case 'chart':
      return (
        <svg viewBox="0 0 24 24" style={common} aria-hidden>
          <path d="M5 19V5M9 19V9M13 19v-6M17 19V7" strokeLinecap="round" />
        </svg>
      )
    case 'book':
      return (
        <svg viewBox="0 0 24 24" style={common} aria-hidden>
          <path d="M6 4h10a2 2 0 0 1 2 2v14l-8-3-8 3V6a2 2 0 0 1 2-2z" />
        </svg>
      )
    case 'gear':
      return (
        <svg viewBox="0 0 24 24" style={common} aria-hidden>
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.26 1.3.73 1.77.47.48 1.11.75 1.77.75H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    default:
      return <span style={{ width: 20, marginRight: 12 }} aria-hidden />
  }
}

export default function Sidebar() {
  const user = getCurrentUser()
  const displayName = 'Coach'
  const roleLabel = user.role === 'staff' ? 'Staff' : user.role

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        flexShrink: 0,
        minHeight: '100vh',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-surface-low)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
      }}
    >
      <div style={{ padding: '0 24px', marginBottom: 24 }}>
        <div
          style={{
            fontSize: 'var(--font-size-headline)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
          }}
        >
          S&amp;C Pro
        </div>
        <div
          className="sc-label-caps"
          style={{
            color: 'var(--color-primary)',
            marginTop: 4,
            letterSpacing: '0.2em',
            fontSize: 10,
          }}
        >
          Elite Performance
        </div>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px' }}>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/programmes'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              padding: '12px 12px',
              borderRadius: 'var(--radius-default)',
              textDecoration: 'none',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              background: isActive ? 'var(--color-primary-soft)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
              fontSize: 'var(--font-size-body-sm)',
              fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
            })}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div
        style={{
          marginTop: 'auto',
          padding: '16px 24px 0',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-surface-high)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text)',
          }}
        >
          {displayName.slice(0, 1)}
        </div>
        <div>
          <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-body-sm)' }}>
            {displayName}
          </div>
          <div className="sc-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {roleLabel}
          </div>
        </div>
      </div>
    </aside>
  )
}
