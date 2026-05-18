import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { buildRemovePatch, INTENSITY_ADD_MENU_KEYS, mergeAddPatch, prescriptionTableColumnCount } from '../lib/prescriptionPillLogic.js'
import {
  cascadeRows,
  gridFieldFromPillKey,
  effortPillKeyForGrid,
  clearExerciseBundle,
  hydrateGridFromExercise,
  MAX_OPT_COLS,
  mkEmptyRow,
  OPTIONAL_GRID_KEYS,
  OPT_META,
  patchFromRow0,
  pillKeyForLoad,
  resizeRows,
  sessionExerciseFingerprint,
} from '../lib/setsRepsGridLogic.js'
import { ADD_BTN, Ch, ColumnAddMenu, EditableCell } from './setsRepsGridCells.jsx'

const MIN_SETS = 1
const MAX_SETS = 30

function clampSets(n) {
  return Math.max(MIN_SETS, Math.min(MAX_SETS, n ?? 3))
}

export default function SetsRepsTable({ exercise, orgId, canEdit, onReload, onColumnMenuAdd, onIntensityBlocked, focusPillKey, onFocusConsumed }) {
  const [setsData, setSetsData] = useState([])
  const [activeColumns, setActiveColumns] = useState([])
  const [active, setActive] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState(null)
  const focusRef = useRef(null)
  const addBtnRef = useRef(null)
  const menuPanelRef = useRef(null)
  const lastExId = useRef(null)
  const lastSetsN = useRef(null)
  const lastFingerprintRef = useRef(undefined)
  const persistTimer = useRef(null)
  const exerciseRef = useRef(exercise)
  const activeColsRef = useRef([])
  exerciseRef.current = exercise
  activeColsRef.current = activeColumns

  const setsFromEx = clampSets(exercise?.sets ?? 3)

  const persist = useCallback(
    async (patch) => {
      if (!exercise?.id || !canEdit || !Object.keys(patch).length) return
      try {
        const { error } = await supabase.from('session_exercises').update(patch).eq('id', exercise.id).eq('org_id', orgId)
        if (error) throw error
        await onReload?.()
      } catch (err) {
        console.error('[SetsRepsTable]', err)
      }
    },
    [exercise?.id, orgId, canEdit, onReload],
  )

  const schedulePersist = useCallback(
    (rows) => {
      clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        void persist(patchFromRow0(rows[0], activeColsRef.current, rows.length, exerciseRef.current))
      }, 200)
    },
    [persist],
  )

  const changeCell = useCallback(
    (setIndex, field, value) => {
      setSetsData((prev) => {
        const next = cascadeRows(prev, setIndex, field, value)
        schedulePersist(next)
        return next
      })
    },
    [schedulePersist],
  )

  useEffect(() => {
    const ex = exerciseRef.current
    if (!ex?.id) return
    const n = clampSets(ex.sets)
    const seed = () => mkEmptyRow(ex.reps)
    const fp = sessionExerciseFingerprint(ex)

    if (lastExId.current !== ex.id) {
      lastExId.current = ex.id
      lastSetsN.current = n
      lastFingerprintRef.current = fp
      clearExerciseBundle(ex.id)
      const h = hydrateGridFromExercise(ex, n)
      setActiveColumns(h.activeColumns)
      setSetsData(h.rows)
      return
    }
    if (lastFingerprintRef.current !== fp) {
      lastFingerprintRef.current = fp
      clearExerciseBundle(ex.id)
      const h = hydrateGridFromExercise(ex, n)
      setActiveColumns(h.activeColumns)
      setSetsData(h.rows)
      lastSetsN.current = n
      return
    }
    if (lastSetsN.current !== n) {
      lastSetsN.current = n
      setSetsData((prev) => resizeRows(prev.length ? prev : Array.from({ length: n }, seed), n, seed()))
    }
  }, [
    exercise?.id,
    exercise?.sets,
    exercise?.reps,
    exercise?.prescription_type,
    exercise?.prescription_value,
    exercise?.secondary_prescription_type,
    exercise?.secondary_prescription_value,
    exercise?.tertiary_prescription_type,
    exercise?.tertiary_prescription_value,
    exercise?.rest_seconds,
    exercise?.tempo,
    exercise?.updated_at,
  ])
  const updateMenuPos = useCallback(() => {
    const el = addBtnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 6, right: r.right, vw: typeof window !== 'undefined' ? window.innerWidth : 0 })
  }, [])
  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPos(null)
      return
    }
    updateMenuPos()
    const fn = () => updateMenuPos()
    window.addEventListener('scroll', fn, true)
    window.addEventListener('resize', fn)
    return () => {
      window.removeEventListener('scroll', fn, true)
      window.removeEventListener('resize', fn)
    }
  }, [menuOpen, updateMenuPos])
  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => {
      const t = e.target
      if (addBtnRef.current?.contains(t)) return
      if (menuPanelRef.current?.contains(t)) return
      setMenuOpen(false)
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [menuOpen])
  useEffect(() => {
    if (!focusPillKey) return
    const gf = gridFieldFromPillKey(focusPillKey)
    if (!gf) {
      onFocusConsumed?.()
      return
    }
    const el = focusRef.current?.querySelector?.(`[data-grid-input="${gf}"]`)
    if (el && typeof el.focus === 'function') {
      el.focus()
      if (typeof el.select === 'function') el.select()
    }
    onFocusConsumed?.()
  }, [focusPillKey, exercise?.id, onFocusConsumed])
  const availableToAdd = useMemo(() => OPTIONAL_GRID_KEYS.filter((k) => !activeColumns.includes(k)), [activeColumns])
  const showPlus = activeColumns.length < MAX_OPT_COLS && availableToAdd.length > 0

  const addColumn = async (key) => {
    if (activeColumns.length >= MAX_OPT_COLS || activeColumns.includes(key)) return
    const menuKey = OPT_META[key]?.pillMenuKey
    const ex = exerciseRef.current
    if (menuKey && INTENSITY_ADD_MENU_KEYS.has(menuKey) && prescriptionTableColumnCount(ex) >= 3) {
      onIntensityBlocked?.()
      setMenuOpen(false)
      return
    }
    if (menuKey) {
      const addPatch = mergeAddPatch(ex, menuKey)
      if (!addPatch || !Object.keys(addPatch).length) {
        setMenuOpen(false)
        return
      }
      if (onColumnMenuAdd) await onColumnMenuAdd(menuKey)
    }
    // After await, fingerprint hydration may already have appended this column (e.g. rest from rest_seconds).
    setActiveColumns((prev) => (prev.includes(key) ? prev : [...prev, key]))
    setSetsData((prev) =>
      prev.length && prev[0] != null && Object.prototype.hasOwnProperty.call(prev[0], key)
        ? prev
        : prev.map((r) => ({ ...r, [key]: '' })),
    )
    setMenuOpen(false)
  }

  const removeColumn = async (key) => {
    if (!OPTIONAL_GRID_KEYS.includes(key)) return
    const colsBefore = activeColumns
    const ex = exerciseRef.current
    setActiveColumns((prev) => prev.filter((k) => k !== key))
    setSetsData((prev) => prev.map((r) => {
      const { [key]: _r, ...rest } = r
      return rest
    }))

    if (key === 'tempo') {
      await persist({ tempo: null })
      return
    }
    const pk =
      key === 'load'
        ? pillKeyForLoad(ex)
        : key === 'pct1rm'
          ? 'pct1rm'
          : key === 'time'
            ? 'time'
          : key === 'distance'
            ? 'distance'
            : key === 'rest'
              ? 'rest'
              : effortPillKeyForGrid(colsBefore, key)
    if (pk) {
      const rm = buildRemovePatch(ex, pk)
      if (Object.keys(rm).length) await persist(rm)
    }
  }

  const bumpSets = (delta) => {
    const next = clampSets((setsData.length || setsFromEx) + delta)
    if (next === (setsData.length || setsFromEx)) return
    void persist({ sets: next })
  }

  if (!exercise || !canEdit) return null

  const rows = setsData.length ? setsData : Array.from({ length: setsFromEx }, () => mkEmptyRow(exercise.reps))
  const nRows = rows.length
  const gridParts = ['minmax(72px, 0.85fr)', 'minmax(88px, 1fr)', ...activeColumns.map(() => 'minmax(104px, 1.15fr)')]
  if (showPlus) gridParts.push('52px')
  const gridTemplateColumns = gridParts.join(' ')
  const tableMinWidthPx = Math.max(320, 88 + 96 + activeColumns.length * 112 + (showPlus ? 56 : 0))

  const cellBase = {
    borderBottom: '1px solid var(--color-border)',
    borderRight: '1px solid var(--color-border)',
    padding: '10px 12px',
    fontSize: 'var(--font-size-body)',
    textAlign: 'center',
    verticalAlign: 'middle',
  }
  const headerCell = {
    ...cellBase,
    background: 'var(--color-surface-high)',
    fontWeight: 'var(--font-weight-semibold)',
    color: 'var(--color-text)',
    borderBottom: '1px solid var(--color-border)',
  }
  const ringBtn = { width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)', fontSize: 20, lineHeight: 1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }
  const rmBtn = { border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }

  const menuOptions = useMemo(
    () => availableToAdd.filter((k) => OPT_META[k]).map((k) => ({ key: k, label: OPT_META[k].label })),
    [availableToAdd],
  )
  const lastColIdx = activeColumns.length - 1

  return (
    <div ref={focusRef} style={{ marginBottom: 10, width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <ColumnAddMenu open={menuOpen} menuPos={menuPos} menuPanelRef={menuPanelRef} options={menuOptions} onPick={(k) => void addColumn(k)} />
      <div style={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: tableMinWidthPx, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'visible' }}>
          <div style={{ display: 'grid', gridTemplateColumns }}>
            <div style={{ ...headerCell, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="sc-body" style={{ display: 'inline-flex', alignItems: 'center' }}>
                {nRows} Sets
                <Ch />
              </span>
            </div>
            <div style={{ ...headerCell, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="sc-body" style={{ display: 'inline-flex', alignItems: 'center' }}>
                Reps
                <Ch />
              </span>
            </div>
            {activeColumns.map((colKey, i) => (
              <div
                key={colKey}
                style={{
                  ...headerCell,
                  borderRight: i === lastColIdx && !showPlus ? 'none' : headerCell.borderRight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                <span className="sc-body" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {OPT_META[colKey]?.label ?? colKey}
                  <Ch />
                </span>
                <button
                  type="button"
                  title={`Remove ${OPT_META[colKey]?.label ?? colKey}`}
                  aria-label={`Remove ${OPT_META[colKey]?.label ?? colKey}`}
                  onClick={() => void removeColumn(colKey)}
                  style={rmBtn}
                >
                  ×
                </button>
              </div>
            ))}
            {showPlus ? (
              <div style={{ ...headerCell, borderRight: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 4px' }}>
                <button ref={addBtnRef} type="button" aria-label="Add column" aria-expanded={menuOpen} style={ADD_BTN} onClick={() => setMenuOpen((o) => !o)}>
                  +
                </button>
              </div>
            ) : null}
          </div>
          {rows.map((row, idx) => (
            <div key={idx + 1} style={{ display: 'grid', gridTemplateColumns, background: 'var(--color-surface)' }}>
              <div style={{ ...cellBase, fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-muted)' }}>{idx + 1}</div>
              <div style={cellBase}>
                <EditableCell
                  rowIdx={idx}
                  field="reps"
                  value={row.reps}
                  meta={{ label: 'Reps', kind: 'number', min: 1, step: 1 }}
                  active={active}
                  setActive={setActive}
                  changeCell={changeCell}
                  dataAttr={idx === 0 ? { 'data-grid-input': 'reps' } : {}}
                />
              </div>
              {activeColumns.map((colKey, i) => (
                <div key={colKey} style={{ ...cellBase, borderRight: i === lastColIdx && !showPlus ? 'none' : cellBase.borderRight }}>
                  <EditableCell
                    rowIdx={idx}
                    field={colKey}
                    value={row[colKey]}
                    meta={OPT_META[colKey] ?? { label: String(colKey), kind: 'number', step: 1 }}
                    active={active}
                    setActive={setActive}
                    changeCell={changeCell}
                    dataAttr={idx === 0 ? { 'data-grid-input': colKey } : {}}
                  />
                </div>
              ))}
              {showPlus ? <div style={{ ...cellBase, borderRight: 'none' }} aria-hidden /> : null}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12 }}>
        <button
          type="button"
          aria-label="Fewer sets"
          disabled={nRows <= MIN_SETS}
          onClick={() => bumpSets(-1)}
          style={{ ...ringBtn, opacity: nRows <= MIN_SETS ? 0.35 : 1, cursor: nRows <= MIN_SETS ? 'not-allowed' : 'pointer' }}
        >
          −
        </button>
        <span className="sc-body" style={{ fontWeight: 'var(--font-weight-medium)', minWidth: 40, textAlign: 'center' }}>
          Sets
        </span>
        <button
          type="button"
          aria-label="More sets"
          disabled={nRows >= MAX_SETS}
          onClick={() => bumpSets(1)}
          style={{ ...ringBtn, opacity: nRows >= MAX_SETS ? 0.35 : 1, cursor: nRows >= MAX_SETS ? 'not-allowed' : 'pointer' }}
        >
          +
        </button>
      </div>
    </div>
  )
}
