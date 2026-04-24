import { useEffect, useState } from 'react'
import { athleteDisplayName } from '../lib/programmeUi.js'
import { btnOutline, btnPrimary } from '../lib/programmeSessionUi.js'
import { useProgrammeAssignment } from '../hooks/useProgrammeAssignment.js'
import { supabase } from '../lib/supabaseClient.js'

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 300,
  padding: 16,
}

const card = {
  width: '100%',
  maxWidth: 420,
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  padding: 'var(--space-container)',
}

function athleteLabel(a) {
  if (!a) return ''
  return athleteDisplayName(a) || a.name || ''
}

export default function AssignProgrammeModal({ programmeId, orgId, onClose, onSuccess }) {
  const { teams, loading, assignToTeam, assignToAthlete } = useProgrammeAssignment(programmeId, orgId)
  const [mode, setMode] = useState('team')
  const [teamId, setTeamId] = useState('')
  const [filterTeamId, setFilterTeamId] = useState('')
  const [athleteId, setAthleteId] = useState('')
  const [rosterRows, setRosterRows] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const canConfirm =
    mode === 'team' ? Boolean(teamId) : Boolean(filterTeamId) && Boolean(athleteId)

  useEffect(() => {
    if (mode !== 'athlete' || !filterTeamId) {
      setRosterRows([])
      return
    }
    let cancelled = false
    ;(async () => {
      setRosterLoading(true)
      try {
        // org_id lives on athletes, not athlete_teams (see useSessionData).
        const { data, error } = await supabase
          .from('athlete_teams')
          .select('athlete_id, athletes(id, org_id, full_name, first_name, last_name)')
          .eq('team_id', filterTeamId)
        if (error) throw error
        const rows = []
        for (const r of data ?? []) {
          const a = r.athletes
          const ath = Array.isArray(a) ? a[0] : a
          if (!ath?.id || ath.org_id !== orgId) continue
          rows.push({
            athlete_id: r.athlete_id,
            id: ath.id,
            full_name: ath.full_name,
            first_name: ath.first_name,
            last_name: ath.last_name,
          })
        }
        rows.sort((x, y) => athleteLabel(x).localeCompare(athleteLabel(y), undefined, { sensitivity: 'base' }))
        if (!cancelled) setRosterRows(rows)
      } catch (err) {
        console.error('[AssignProgramme]', err)
        if (!cancelled) setRosterRows([])
      } finally {
        if (!cancelled) setRosterLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, filterTeamId, orgId])

  const handleConfirm = async () => {
    if (!canConfirm || busy) return
    setBusy(true)
    try {
      if (mode === 'team') {
        await assignToTeam(teamId)
        const name = teams.find((t) => t.id === teamId)?.name || 'team'
        onSuccess?.(`Programme assigned to ${name}`)
      } else {
        await assignToAthlete(athleteId)
        const row = rosterRows.find((a) => a.id === athleteId)
        const name = athleteLabel(row) || 'athlete'
        onSuccess?.(`Programme assigned to ${name}`)
      }
      onClose?.()
    } catch (err) {
      console.error('[AssignProgramme]', err)
    } finally {
      setBusy(false)
    }
  }

  const sel = { width: '100%', marginTop: 8, padding: '10px 12px', borderRadius: 'var(--radius-default)', border: '1px solid var(--color-border)', background: 'var(--color-surface-low)', color: 'var(--color-text)' }

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="assign-prog-title" onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h2 id="assign-prog-title" className="sc-headline" style={{ marginTop: 0 }}>
          Assign Programme
        </h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
          <input
            type="radio"
            name="assign-mode"
            checked={mode === 'team'}
            onChange={() => {
              setMode('team')
              setFilterTeamId('')
              setAthleteId('')
              setRosterRows([])
            }}
          />
          <span className="sc-body-sm">Assign to Team</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
          <input
            type="radio"
            name="assign-mode"
            checked={mode === 'athlete'}
            onChange={() => {
              setMode('athlete')
              setTeamId('')
              setFilterTeamId('')
              setAthleteId('')
              setRosterRows([])
            }}
          />
          <span className="sc-body-sm">Assign to Athlete</span>
        </label>
        {mode === 'team' ? (
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={loading} style={sel}>
            <option value="">Select a team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
              Filter by Team
            </label>
            <select
              value={filterTeamId}
              onChange={(e) => {
                setFilterTeamId(e.target.value)
                setAthleteId('')
              }}
              disabled={loading}
              style={sel}
            >
              <option value="">Select a team first...</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {filterTeamId ? (
              <>
                <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
                  Select Athlete
                </label>
                <select value={athleteId} onChange={(e) => setAthleteId(e.target.value)} disabled={loading || rosterLoading} style={sel}>
                  <option value="">Select an athlete...</option>
                  {rosterRows.map((a) => (
                    <option key={a.id} value={a.id}>
                      {athleteLabel(a)}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" style={btnOutline} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            style={btnPrimary}
            onClick={() => void handleConfirm()}
            disabled={!canConfirm || busy || loading || (mode === 'athlete' && !!filterTeamId && rosterLoading)}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
