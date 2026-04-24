import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'
import { getCurrentUser } from '../../lib/auth.js'

const LS_RECENT = 'sc_pro_recent_exercises_v1'

function readRecent() {
  try {
    const raw = localStorage.getItem(LS_RECENT)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function pushRecent(id) {
  const cur = readRecent().filter((x) => x !== id)
  cur.unshift(id)
  localStorage.setItem(LS_RECENT, JSON.stringify(cur.slice(0, 10)))
}

const PATTERNS = ['push', 'pull', 'hinge', 'squat', 'carry', 'rotate', 'jump', 'sprint', 'isometric', 'custom']
const EQUIP = ['barbell', 'dumbbell', 'cable', 'machine', 'band', 'bodyweight', 'kettlebell']

export default function SessionExerciseSearch({ onPick, onClose, onNewExercise }) {
  const user = getCurrentUser()
  const [q, setQ] = useState('')
  const [pattern, setPattern] = useState('All')
  const [equip, setEquip] = useState('All')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      try {
        const { data: sys, error: e1 } = await supabase
          .from('exercise_library')
          .select('*')
          .eq('is_system_default', true)
          .is('org_id', null)
          .order('name')
        if (e1) throw e1
        const { data: org, error: e2 } = await supabase.from('exercise_library').select('*').eq('org_id', user.orgId).order('name')
        if (e2) throw e2
        if (!cancel) setRows([...(sys ?? []), ...(org ?? [])])
      } catch (e) {
        console.error('[SessionBuilder] library', e)
        if (!cancel) setRows([])
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [user.orgId])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (q && !(`${r.name} ${(r.tags || []).join(' ')}`).toLowerCase().includes(q.toLowerCase())) return false
      if (pattern !== 'All' && r.movement_pattern !== pattern) return false
      if (equip !== 'All' && !(r.equipment_required || []).includes(equip)) return false
      return true
    })
  }, [rows, q, pattern, equip])

  const recentIds = readRecent()
  const recentRows = useMemo(() => {
    const m = new Map(rows.map((r) => [r.id, r]))
    return recentIds.map((id) => m.get(id)).filter(Boolean)
  }, [rows, recentIds])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 className="sc-headline" style={{ margin: 0 }}>
          Add exercise
        </h2>
        <button type="button" style={btnGhost} onClick={onClose}>
          Close
        </button>
      </div>
      <input
        autoFocus
        placeholder="Search…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={inp}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <select value={pattern} onChange={(e) => setPattern(e.target.value)} style={inp}>
          <option>All</option>
          {PATTERNS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={equip} onChange={(e) => setEquip(e.target.value)} style={inp}>
          <option>All</option>
          {EQUIP.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', marginTop: 12 }}>
          Loading…
        </p>
      ) : (
        <>
          <p className="sc-label-caps" style={{ marginTop: 16 }}>
            Recent
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', maxHeight: 140, overflow: 'auto' }}>
            {recentRows.map((r) => (
              <li key={r.id}>
                <button type="button" style={rowBtn} onClick={() => { pushRecent(r.id); onPick(r) }}>
                  <span>{r.name}</span>
                  <span style={pill}>{r.movement_pattern}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="sc-label-caps" style={{ marginTop: 12 }}>
            Results
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', flex: 1, overflow: 'auto' }}>
            {filtered.map((r) => (
              <li key={r.id}>
                <button type="button" style={rowBtn} onClick={() => { pushRecent(r.id); onPick(r) }}>
                  <span>{r.name}</span>
                  <span style={pill}>{r.movement_pattern}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" style={{ ...btnPrimary, marginTop: 12 }} onClick={onNewExercise}>
        New Exercise
      </button>
    </div>
  )
}

const btnPrimary = {
  padding: '10px 16px',
  borderRadius: 'var(--radius-default)',
  border: 'none',
  background: 'var(--color-primary)',
  color: 'var(--color-text)',
  fontWeight: 'var(--font-weight-semibold)',
  cursor: 'pointer',
}
const btnGhost = { ...btnPrimary, background: 'transparent', border: '1px solid var(--color-border)' }
const inp = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-default)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-low)',
  color: 'var(--color-text)',
}
const rowBtn = {
  width: '100%',
  textAlign: 'left',
  padding: '8px 10px',
  marginBottom: 4,
  borderRadius: 'var(--radius-default)',
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--color-text)',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
}
const pill = {
  fontSize: 10,
  padding: '2px 8px',
  borderRadius: 'var(--radius-full)',
  background: 'var(--color-surface-high)',
  color: 'var(--color-text-muted)',
  textTransform: 'capitalize',
}
