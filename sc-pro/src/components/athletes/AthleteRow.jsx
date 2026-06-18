import { useContext, useMemo, useState } from 'react'
import { useUser } from '../../context/UserContext.jsx'
import { canSync } from '../../lib/auth.js'
import { AthletePdfExportContext } from './ProgrammeExportModal.jsx'

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'A'
}

function relDateLabel(iso) {
  if (!iso) return 'Never'
  const d = new Date(`${iso}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const delta = Math.round((now - d) / (1000 * 60 * 60 * 24))
  if (delta <= 0) return 'Today'
  if (delta === 1) return '1 day ago'
  return `${delta} days ago`
}

function complianceColor(percent) {
  if (percent >= 80) return 'var(--color-excellent)'
  if (percent >= 60) return 'var(--color-primary)'
  return 'var(--color-below-avg)'
}

function assessmentColor(label) {
  const n = String(label || '').toLowerCase()
  if (n === 'excellent' || n === 'elite') return 'var(--color-excellent)'
  if (n === 'above average') return 'var(--color-above-avg)'
  if (n === 'average') return 'var(--color-avg)'
  if (n === 'below average') return 'var(--color-below-avg)'
  return 'var(--color-text-muted)'
}

function ActionIcon({ children }) {
  return (
    <span style={{ display: 'inline-flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </span>
  )
}

function IconPrinter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: 'block' }}>
      <path
        d="M7 16h10v4H7v-4zm-3-5h16v9H4v-9zm2 0V4h12v7M7 4h10v3H7V4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function AthleteRow({ athlete, isSelected, onSelect, onViewProfile }) {
  const { user } = useUser()
  const setExportAthlete = useContext(AthletePdfExportContext)
  const [hovered, setHovered] = useState(false)
  const profileName = athlete.display_name || athlete.name
  const complianceTone = useMemo(() => complianceColor(athlete.compliance_percent || 0), [athlete.compliance_percent])
  const assessmentTone = assessmentColor(athlete.assessment_overall)

  return (
    <tr
      className="sc-table-row"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? 'var(--color-surface-high)' : 'transparent' }}
    >
      <td style={{ width: 44, padding: '12px 10px' }}>
        <input type="checkbox" checked={isSelected} onChange={() => onSelect?.(athlete.id)} />
      </td>
      <td style={{ padding: '12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {athlete.photo_url ? (
            <img
              src={athlete.photo_url}
              alt={profileName}
              style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-surface-highest)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              {initials(profileName)}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{profileName}</div>
            <div className="sc-body-sm" style={{ color: 'var(--color-text-muted)' }}>
              {athlete.email || '—'}
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: '12px 10px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(athlete.teams || []).map((t) => (
            <span
              key={t.id}
              className="sc-body-sm"
              style={{
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-high)',
                color: 'var(--color-text)',
              }}
            >
              {t.name}
            </span>
          ))}
          {(!athlete.teams || athlete.teams.length === 0) && <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
        </div>
      </td>
      <td style={{ padding: '12px 10px' }}>
        {(athlete.programmes ?? []).length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {(athlete.programmes ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => window.alert('Programme details coming soon')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-primary)',
                  fontWeight: 'var(--font-weight-semibold)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        )}
      </td>
      <td style={{ padding: '12px 10px' }}>{relDateLabel(athlete.last_session_date)}</td>
      <td style={{ padding: '12px 10px', minWidth: 130 }}>
        {athlete.has_session_data ? (
          <div>
            <div style={{ color: complianceTone, fontWeight: 'var(--font-weight-semibold)', marginBottom: 4 }}>
              {athlete.compliance_percent}%
            </div>
            <div style={{ height: 4, background: 'var(--color-surface-high)', borderRadius: 'var(--radius-full)' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, athlete.compliance_percent || 0))}%`,
                  borderRadius: 'var(--radius-full)',
                  background: complianceTone,
                }}
              />
            </div>
          </div>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        )}
      </td>
      <td style={{ padding: '12px 10px' }}>
        {athlete.assessment_overall ? (
          <span
            className="sc-label-caps"
            style={{
              borderRadius: 'var(--radius-full)',
              padding: '4px 8px',
              color: assessmentTone,
              background: 'color-mix(in srgb, var(--color-surface) 70%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-border) 70%, transparent)',
            }}
          >
            {athlete.assessment_overall}
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        )}
      </td>
      <td style={{ padding: '12px 10px', textAlign: 'right', minWidth: 148 }}>
        <div style={{ display: 'inline-flex', gap: 6, opacity: hovered ? 1 : 0.88 }}>
          <button
            type="button"
            title="View Profile"
            onClick={() => onViewProfile?.(athlete)}
            style={iconBtn}
          >
            <ActionIcon>👤</ActionIcon>
          </button>
          {canSync(user, 'sc_pro', 'edit') && (
            <button type="button" title="Assign Programme" onClick={() => window.alert('Coming soon')} style={iconBtn}>
              <ActionIcon>📅</ActionIcon>
            </button>
          )}
          <button type="button" title="View Analytics" onClick={() => window.alert('Coming soon')} style={iconBtn}>
            <ActionIcon>📊</ActionIcon>
          </button>
          <button
            type="button"
            title="Export Programme PDF"
            onClick={() => setExportAthlete?.(athlete)}
            style={iconBtn}
            disabled={!setExportAthlete}
          >
            <ActionIcon>
              <IconPrinter />
            </ActionIcon>
          </button>
        </div>
      </td>
    </tr>
  )
}

const iconBtn = {
  width: 28,
  height: 28,
  borderRadius: 'var(--radius-default)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'color-mix(in srgb, var(--color-text) 82%, transparent)',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
}
