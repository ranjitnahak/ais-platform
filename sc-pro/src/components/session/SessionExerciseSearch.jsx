import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'
import { getCurrentUser } from '../../lib/auth.js'
import { useExerciseCategories } from '../../hooks/useExerciseCategories.js'
import AddExerciseModal from './AddExerciseModal.jsx'

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

const EQUIP_FILTER_OPTS = [
  { value: '', label: 'All equipment' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'band', label: 'Band' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'cable', label: 'Cable' },
  { value: 'machine', label: 'Machine' },
  { value: 'trx', label: 'TRX' },
  { value: 'med ball', label: 'Med Ball' },
  { value: 'sled', label: 'Sled' },
]

const LIB_SELECT = `
  *,
  region:region_id(id, name),
  pattern:pattern_id(id, name)
`

function libraryVisibilityOr(orgId, userId) {
  return `org_id.is.null,and(org_id.eq.${orgId},or(status.eq.approved,created_by.eq.${userId}))`
}

export default function SessionExerciseSearch({ onPick, onClose, onNewExercise: _onNewExercise }) {
  const user = getCurrentUser()
  const { regions, patterns, loading: catLoading, error: catError } = useExerciseCategories()
  const [q, setQ] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [patternFilter, setPatternFilter] = useState('')
  const [equipFilter, setEquipFilter] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('exercise_library')
          .select(LIB_SELECT)
          .or(libraryVisibilityOr(user.orgId, user.id))
          .order('name')
        if (error) throw error
        if (!cancel) setRows(data ?? [])
      } catch (e) {
        console.error('[SessionExerciseSearch] library', e)
        if (!cancel) setRows([])
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [user.orgId, user.id])

  const patternsForRegionFilter = useMemo(() => {
    if (!regionFilter) return patterns
    return patterns.filter((p) => p.parent_id === regionFilter)
  }, [patterns, regionFilter])

  const filtered = useMemo(() => {
    const qt = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (regionFilter && r.region?.id !== regionFilter) return false
      if (patternFilter && r.pattern?.id !== patternFilter) return false
      if (equipFilter) {
        const list = (r.equipment_required || []).map((x) => String(x).toLowerCase())
        if (!list.includes(equipFilter.toLowerCase())) return false
      }
      if (qt) {
        const name = (r.name || '').toLowerCase()
        const tagStr = ((r.tags || []) || []).join(' ').toLowerCase()
        if (!name.includes(qt) && !tagStr.includes(qt)) return false
      }
      return true
    })
  }, [rows, q, regionFilter, patternFilter, equipFilter])

  const recentIds = readRecent()
  const recentRows = useMemo(() => {
    const m = new Map(rows.map((r) => [r.id, r]))
    return recentIds.map((id) => m.get(id)).filter(Boolean)
  }, [rows, recentIds])

  const onExerciseAdded = (ex) => {
    setRows((prev) => {
      if (prev.some((r) => r.id === ex.id)) return prev
      return [...prev, ex].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    })
  }

  const busy = loading || catLoading

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

      {catError ? (
        <p className="sc-body-sm" style={{ color: 'var(--color-danger)', margin: '0 0 10px' }}>
          {catError}
        </p>
      ) : null}
      {!catLoading && !catError && regions.length === 0 ? (
        <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
          No regions loaded. In Supabase SQL, run ais/sql/sc_pro_exercise_categories_rls_v1.sql (or add your own SELECT
          policies on exercise_categories for anon/authenticated, including org_id null system rows). Also confirm rows
          exist with type = region.
        </p>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <select
          value={regionFilter}
          onChange={(e) => {
            setRegionFilter(e.target.value)
            setPatternFilter('')
          }}
          style={{ ...inp, flex: '1 1 140px', minWidth: 120 }}
          aria-label="Filter by region"
          disabled={catLoading}
        >
          <option value="">All Regions</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={patternFilter}
          onChange={(e) => setPatternFilter(e.target.value)}
          style={{ ...inp, flex: '1 1 140px', minWidth: 120 }}
          aria-label="Filter by pattern"
          disabled={catLoading}
        >
          <option value="">All Patterns</option>
          {patternsForRegionFilter.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={equipFilter}
          onChange={(e) => setEquipFilter(e.target.value)}
          style={{ ...inp, flex: '1 1 140px', minWidth: 120 }}
          aria-label="Filter by equipment"
        >
          {EQUIP_FILTER_OPTS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <input
        autoFocus
        placeholder="Search…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={inp}
      />

      {busy ? (
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
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span style={{ display: 'block' }}>{r.name}</span>
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {r.region?.name ? <span style={pill}>{r.region.name}</span> : null}
                      {r.pattern?.name ? <span style={pillMuted}>{r.pattern.name}</span> : null}
                      {(r.equipment_required || []).slice(0, 4).map((eq) => (
                        <span key={eq} style={pillEq}>
                          {eq}
                        </span>
                      ))}
                    </span>
                  </span>
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
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span style={{ display: 'block', fontWeight: 'var(--font-weight-medium)' }}>{r.name}</span>
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {r.region?.name ? <span style={pill}>{r.region.name}</span> : null}
                      {r.pattern?.name ? <span style={pillMuted}>{r.pattern.name}</span> : null}
                      {(r.equipment_required || []).map((eq) => (
                        <span key={eq} style={pillEq}>
                          {eq}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" style={{ ...btnPrimary, marginTop: 12 }} onClick={() => setAddOpen(true)}>
        + New Exercise
      </button>

      <AddExerciseModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        regions={regions}
        patterns={patterns}
        onExerciseAdded={onExerciseAdded}
      />
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
  boxSizing: 'border-box',
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
  alignItems: 'flex-start',
  gap: 8,
}
const pill = {
  fontSize: 10,
  padding: '2px 8px',
  borderRadius: 'var(--radius-full)',
  background: 'var(--color-primary-soft)',
  color: 'var(--color-primary)',
  textTransform: 'none',
}
const pillMuted = {
  ...pill,
  background: 'var(--color-surface-high)',
  color: 'var(--color-text-muted)',
}
const pillEq = {
  fontSize: 10,
  padding: '2px 6px',
  borderRadius: 'var(--radius-full)',
  background: 'var(--color-surface-high)',
  color: 'var(--color-text-muted)',
  textTransform: 'capitalize',
}
