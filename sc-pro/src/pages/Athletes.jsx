import { useEffect, useMemo, useState } from 'react'
import { useAthletes } from '../hooks/useAthletes.js'
import { useAssistantAthletes } from '../hooks/useAssistantAthletes.js'
import { ASSISTANT_ACTION_COMPLETE } from '../lib/assistantContext.js'
import AthleteTable from '../components/athletes/AthleteTable.jsx'
import AthleteProfilePanel from '../components/athletes/AthleteProfilePanel.jsx'
import ProgrammeExportModal, { AthletePdfExportContext } from '../components/athletes/ProgrammeExportModal.jsx'

function sortByName(list) {
  return [...list].sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''))
}

export default function Athletes() {
  const { athletes, teams, loading, error, refetch } = useAthletes()
  const [teamFilter, setTeamFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [profileAthlete, setProfileAthlete] = useState(null)
  const [exportAthlete, setExportAthlete] = useState(null)
  const [addOpen, setAddOpen] = useState(false)

  useAssistantAthletes({ athletes, setTeamFilter })

  useEffect(() => {
    const h = (e) => {
      if (e.detail?.pageKey !== 'athletes') return
      void refetch()
    }
    window.addEventListener(ASSISTANT_ACTION_COMPLETE, h)
    return () => window.removeEventListener(ASSISTANT_ACTION_COMPLETE, h)
  }, [refetch])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sortByName(
      athletes.filter((a) => {
        if (teamFilter && !a.teams.some((t) => t.id === teamFilter)) return false
        if (!q) return true
        const n = (a.display_name || '').toLowerCase()
        const e = (a.email || '').toLowerCase()
        return n.includes(q) || e.includes(q)
      }),
    )
  }, [athletes, search, teamFilter])

  const toggleSelect = (id) => {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  const toggleSelectAll = () => {
    setSelectedIds((cur) => (cur.length === filtered.length ? [] : filtered.map((a) => a.id)))
  }

  return (
    <AthletePdfExportContext.Provider value={setExportAthlete}>
    <section style={{ padding: 'var(--space-container)', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 className="sc-headline" style={{ margin: 0, letterSpacing: 'var(--letter-spacing-label)', textTransform: 'uppercase' }}>
          Athletes
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={controlStyle}>
            <option value="">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search athletes..."
            style={{ ...controlStyle, width: 260 }}
          />
          <button type="button" onClick={() => setAddOpen(true)} style={addBtn}>
            + Add Athlete
          </button>
        </div>
      </div>

      <AthleteTable
        athletes={filtered}
        loading={loading}
        error={error}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onViewProfile={setProfileAthlete}
      />

      {selectedIds.length > 0 && (
        <div style={bulkBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="sc-label-caps" style={{ color: 'var(--color-text)' }}>
              {selectedIds.length} athletes selected
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={bulkPrimaryBtn} onClick={() => window.alert('Coming soon')}>
              Assign Programme
            </button>
            <button type="button" style={bulkGhostBtn} onClick={() => window.alert('Coming soon')}>
              Remove from Team
            </button>
            <button type="button" style={{ ...bulkGhostBtn, color: 'var(--color-below-avg)' }} onClick={() => window.alert('Coming soon')}>
              Archive
            </button>
          </div>
        </div>
      )}

      {addOpen && (
        <div style={addBackdrop} onMouseDown={() => setAddOpen(false)}>
          <div style={addModal} onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="sc-headline" style={{ margin: '0 0 10px' }}>
              Add Athlete
            </h3>
            <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: 0 }}>
              Athletes are managed in AIS for bundle orgs. For S&C Pro standalone orgs, add-athlete flow is coming soon in a
              V1 update.
            </p>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" style={bulkGhostBtn} onClick={() => setAddOpen(false)}>
                Close
              </button>
              <button type="button" style={bulkPrimaryBtn} onClick={() => window.alert('Open AIS roster link coming soon')}>
                Open AIS Roster
              </button>
            </div>
          </div>
        </div>
      )}

      <AthleteProfilePanel athlete={profileAthlete} onClose={() => setProfileAthlete(null)} />

      {exportAthlete ? (
        <ProgrammeExportModal athlete={exportAthlete} onClose={() => setExportAthlete(null)} />
      ) : null}
    </section>
    </AthletePdfExportContext.Provider>
  )
}

const controlStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-default)',
  background: 'var(--color-surface-high)',
  color: 'var(--color-text)',
  padding: '8px 10px',
  minWidth: 160,
}

const addBtn = {
  border: 'none',
  borderRadius: 'var(--radius-default)',
  padding: '9px 14px',
  background: 'var(--color-primary)',
  color: 'var(--color-text)',
  fontWeight: 'var(--font-weight-semibold)',
  cursor: 'pointer',
}

const bulkBar = {
  position: 'fixed',
  left: 'calc(var(--sidebar-width) + 24px)',
  right: 24,
  bottom: 16,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--color-surface-high)',
  padding: 12,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  zIndex: 1000,
}

const bulkPrimaryBtn = {
  border: 'none',
  borderRadius: 'var(--radius-default)',
  padding: '8px 12px',
  background: 'var(--color-primary)',
  color: 'var(--color-text)',
  fontWeight: 'var(--font-weight-semibold)',
  cursor: 'pointer',
}

const bulkGhostBtn = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-default)',
  padding: '8px 12px',
  background: 'transparent',
  color: 'var(--color-text)',
  fontWeight: 'var(--font-weight-semibold)',
  cursor: 'pointer',
}

const addBackdrop = {
  position: 'fixed',
  inset: 0,
  background: 'color-mix(in srgb, var(--color-bg) 60%, transparent)',
  zIndex: 1100,
  display: 'grid',
  placeItems: 'center',
}

const addModal = {
  width: 460,
  maxWidth: '92vw',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--color-surface-low)',
  padding: 14,
}
