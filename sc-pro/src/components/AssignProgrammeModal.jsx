import { useEffect, useRef, useState } from 'react'
import { athleteDisplayName } from '../lib/programmeUi.js'
import { btnOutline, btnPrimary } from '../lib/programmeSessionUi.js'
import { useProgrammeAssignment } from '../hooks/useProgrammeAssignment.js'
import { supabase } from '../lib/supabaseClient.js'
import { getCurrentUser } from '../lib/auth.js'

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
  maxWidth: 440,
  maxHeight: '90vh',
  overflow: 'auto',
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  padding: 'var(--space-container)',
}

function athleteLabel(a) {
  if (!a) return ''
  return athleteDisplayName(a) || a.name || ''
}

function formatSaveError(err) {
  if (!err) return 'Save failed'
  const m = err.message || err.error_description || String(err)
  const hint = err.hint ? ` (${err.hint})` : ''
  const details = err.details && err.details !== m ? ` — ${err.details}` : ''
  return `${m}${details}${hint}`
}

export default function AssignProgrammeModal({ programmeId, orgId, onClose, onSuccess, onError }) {
  const { teams, loading, syncTeamAssignments, syncAthleteAssignments } = useProgrammeAssignment(programmeId, orgId)
  const [mode, setMode] = useState('team')
  const [teamSel, setTeamSel] = useState(() => new Set())
  const [filterTeamId, setFilterTeamId] = useState('')
  const [athleteSel, setAthleteSel] = useState(() => new Set())
  const [rosterRows, setRosterRows] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [assignLoading, setAssignLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const assignLoadGen = useRef(0)

  useEffect(() => {
    const gen = ++assignLoadGen.current
    ;(async () => {
      setAssignLoading(true)
      setSaveError('')
      try {
        const [pt, pa] = await Promise.all([
          supabase.from('programme_teams').select('team_id').eq('programme_id', programmeId).eq('org_id', orgId),
          supabase.from('programme_athletes').select('athlete_id').eq('programme_id', programmeId).eq('org_id', orgId),
        ])
        if (pt.error) throw pt.error
        if (pa.error) throw pa.error
        if (assignLoadGen.current === gen) {
          setTeamSel(new Set((pt.data ?? []).map((r) => r.team_id).filter(Boolean)))
          setAthleteSel(new Set((pa.data ?? []).map((r) => r.athlete_id).filter(Boolean)))
        }
      } catch (err) {
        console.error('[AssignProgrammeModal] load assignments', err)
        if (assignLoadGen.current === gen) {
          setTeamSel(new Set())
          setAthleteSel(new Set())
          setSaveError(
            `Could not load current assignments: ${formatSaveError(err)}. If tables programme_teams / programme_athletes are missing, run the SQL migration in Supabase.`,
          )
        }
      } finally {
        if (assignLoadGen.current === gen) setAssignLoading(false)
      }
    })()
  }, [programmeId, orgId])

  useEffect(() => {
    if (mode !== 'athlete' || !filterTeamId) {
      setRosterRows([])
      return
    }
    let cancelled = false
    ;(async () => {
      setRosterLoading(true)
      try {
        const user = await getCurrentUser()
        const { data, error } = await supabase
          .from('athlete_teams')
          .select('athlete_id, athletes(id, org_id, full_name, first_name, last_name)')
          .eq('org_id', user.orgId)
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
        console.error('[AssignProgrammeModal] roster', err)
        if (!cancelled) setRosterRows([])
      } finally {
        if (!cancelled) setRosterLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, filterTeamId, orgId])

  const toggleTeam = (id) => {
    setTeamSel((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const toggleAthlete = (id) => {
    setAthleteSel((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const handleConfirm = async () => {
    if (busy || assignLoading) return
    setSaveError('')
    setBusy(true)
    try {
      if (mode === 'team') {
        await syncTeamAssignments([...teamSel])
        onSuccess?.('Team assignments updated')
      } else {
        await syncAthleteAssignments([...athleteSel])
        onSuccess?.('Athlete assignments updated')
      }
      onClose?.()
    } catch (err) {
      console.error('[AssignProgrammeModal]', err)
      const msg = formatSaveError(err)
      setSaveError(msg)
      onError?.(msg)
    } finally {
      setBusy(false)
    }
  }

  const sel = {
    width: '100%',
    marginTop: 8,
    padding: '10px 12px',
    borderRadius: 'var(--radius-default)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-low)',
    color: 'var(--color-text)',
  }

  const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="assign-prog-title" onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h2 id="assign-prog-title" className="sc-headline" style={{ marginTop: 0 }}>
          Assign Programme
        </h2>
        <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', marginBottom: 12 }}>
          Select one or more teams (every athlete on those teams) or specific athletes. Changes replace the current list for that mode.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
          <input
            type="radio"
            name="assign-mode"
            checked={mode === 'team'}
            onChange={() => {
              setMode('team')
              setFilterTeamId('')
              setRosterRows([])
              setSaveError('')
            }}
          />
          <span className="sc-body-sm">Teams</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, cursor: 'pointer' }}>
          <input
            type="radio"
            name="assign-mode"
            checked={mode === 'athlete'}
            onChange={() => {
              setMode('athlete')
              setFilterTeamId('')
              setRosterRows([])
              setSaveError('')
            }}
          />
          <span className="sc-body-sm">Athletes</span>
        </label>

        {mode === 'team' ? (
          <div style={{ marginTop: 12 }}>
            {teams.map((t) => (
              <label key={t.id} style={rowStyle}>
                <input type="checkbox" checked={teamSel.has(t.id)} onChange={() => toggleTeam(t.id)} disabled={loading || assignLoading} />
                <span className="sc-body-sm">{t.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <>
            <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
              Filter roster by team
            </label>
            <select
              value={filterTeamId}
              onChange={(e) => {
                setFilterTeamId(e.target.value)
              }}
              disabled={loading || assignLoading}
              style={sel}
            >
              <option value="">Select a team…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {filterTeamId ? (
              <div style={{ marginTop: 10 }}>
                {rosterLoading ? (
                  <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Loading roster…
                  </p>
                ) : (
                  rosterRows.map((a) => (
                    <label key={a.id} style={rowStyle}>
                      <input type="checkbox" checked={athleteSel.has(a.id)} onChange={() => toggleAthlete(a.id)} disabled={assignLoading} />
                      <span className="sc-body-sm">{athleteLabel(a)}</span>
                    </label>
                  ))
                )}
              </div>
            ) : null}
          </>
        )}

        {saveError ? (
          <p className="sc-body-sm" role="alert" style={{ color: 'var(--color-danger)', marginTop: 16, marginBottom: 0 }}>
            {saveError}
          </p>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" style={btnOutline} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            style={{
              ...btnPrimary,
              ...(busy || loading || assignLoading ? { opacity: 0.55, cursor: 'not-allowed' } : {}),
            }}
            onClick={() => void handleConfirm()}
            disabled={busy || loading || assignLoading}
            title={assignLoading || loading ? 'Loading…' : undefined}
          >
            {assignLoading || loading ? 'Loading…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
