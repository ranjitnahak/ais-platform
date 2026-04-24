import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { deriveTableIntensityColumns, formatIntensityCellValue } from '../lib/prescriptionPillLogic.js'

const MIN_SETS = 1
const MAX_SETS = 30

function Chevron() {
  return (
    <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--color-text-muted)', opacity: 0.85 }} aria-hidden>
      ▾
    </span>
  )
}

export default function SetsRepsTable({
  exercise,
  orgId,
  canEdit,
  onReload,
  headerAddSlot,
  onSaveIntensity,
  onRemoveIntensity,
  focusPillKey,
  onFocusConsumed,
}) {
  const [repsDraft, setRepsDraft] = useState(null)
  const [intensityDrafts, setIntensityDrafts] = useState({})
  const focusRef = useRef(null)

  const intensityColumns = useMemo(() => deriveTableIntensityColumns(exercise), [exercise])

  const sets = Math.max(MIN_SETS, Math.min(MAX_SETS, exercise?.sets ?? 3))
  const repsVal = exercise?.reps

  const repsDisplay = repsDraft !== null ? repsDraft : repsVal != null ? String(repsVal) : ''

  useEffect(() => {
    setRepsDraft(null)
    setIntensityDrafts({})
  }, [
    exercise?.id,
    exercise?.reps,
    exercise?.sets,
    exercise?.rest_seconds,
    exercise?.prescription_type,
    exercise?.prescription_value,
    exercise?.secondary_prescription_type,
    exercise?.secondary_prescription_value,
    exercise?.tertiary_prescription_type,
    exercise?.tertiary_prescription_value,
  ])

  useEffect(() => {
    if (!focusPillKey) return
    const el = focusRef.current?.querySelector?.(`[data-intensity-input="${focusPillKey}"]`)
    if (el && typeof el.focus === 'function') {
      el.focus()
      if (typeof el.select === 'function') el.select()
    }
    onFocusConsumed?.()
  }, [focusPillKey, exercise?.id, onFocusConsumed])

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

  const bumpSets = (delta) => {
    const next = Math.max(MIN_SETS, Math.min(MAX_SETS, sets + delta))
    if (next === sets) return
    void persist({ sets: next })
  }

  const commitReps = () => {
    const raw = repsDisplay.trim()
    const n = raw === '' ? null : Math.round(Number(raw))
    if (raw !== '' && !Number.isFinite(n)) {
      setRepsDraft(null)
      return
    }
    setRepsDraft(null)
    void persist({ reps: n })
  }

  const commitIntensity = async (pillKey) => {
    const d = intensityDrafts[pillKey]
    const display = d !== undefined && d !== null ? d : formatIntensityCellValue(exercise, pillKey)
    await onSaveIntensity?.(pillKey, display)
    setIntensityDrafts((prev) => ({ ...prev, [pillKey]: null }))
  }

  if (!exercise || !canEdit) return null

  const addCol = Boolean(headerAddSlot)
  const gridParts = ['minmax(72px, 0.85fr)', 'minmax(88px, 1fr)', ...intensityColumns.map(() => 'minmax(104px, 1.15fr)')]
  if (addCol) gridParts.push('52px')
  const gridTemplateColumns = gridParts.join(' ')
  const nInt = intensityColumns.length
  const tableMinWidthPx = Math.max(320, 88 + 96 + nInt * 112 + (addCol ? 56 : 0))

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

  const inputStyle = {
    width: '100%',
    maxWidth: 88,
    margin: '0 auto',
    display: 'block',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-size-body)',
    textAlign: 'center',
    boxSizing: 'border-box',
  }

  const ringBtn = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '2px solid var(--color-primary)',
    background: 'transparent',
    color: 'var(--color-primary)',
    fontSize: 20,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    flexShrink: 0,
  }

  const renderIntensityCell = (col, rowIdx) => {
    const { pillKey, headerLabel, step, min, max } = col
    const stored = formatIntensityCellValue(exercise, pillKey)
    const display =
      intensityDrafts[pillKey] !== undefined && intensityDrafts[pillKey] !== null ? intensityDrafts[pillKey] : stored

    if (rowIdx === 0) {
      return (
        <input
          data-intensity-input={pillKey}
          type="number"
          min={min}
          max={max}
          step={step}
          placeholder="—"
          value={display}
          onChange={(e) => setIntensityDrafts((prev) => ({ ...prev, [pillKey]: e.target.value }))}
          onBlur={() => void commitIntensity(pillKey)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void commitIntensity(pillKey)
            }
          }}
          style={{ ...inputStyle, margin: '0 auto' }}
          aria-label={headerLabel}
        />
      )
    }
    return (
      <span className="sc-body" style={{ color: 'var(--color-text-muted)' }}>
        {stored !== '' ? stored : '—'}
      </span>
    )
  }

  return (
    <div ref={focusRef} style={{ marginBottom: 10, width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <div
        style={{
          overflowX: 'auto',
          overflowY: 'visible',
          maxWidth: '100%',
          WebkitOverflowScrolling: 'touch',
          marginBottom: 0,
        }}
      >
        <div
          style={{
            minWidth: tableMinWidthPx,
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'visible',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns }}>
          <div style={{ ...headerCell, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="sc-body" style={{ display: 'inline-flex', alignItems: 'center' }}>
              {sets} Sets
              <Chevron />
            </span>
          </div>
          <div style={{ ...headerCell, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="sc-body" style={{ display: 'inline-flex', alignItems: 'center' }}>
              Reps
              <Chevron />
            </span>
          </div>
          {intensityColumns.map((col, i) => (
            <div
              key={col.pillKey}
              style={{
                ...headerCell,
                borderRight: i === intensityColumns.length - 1 && !addCol ? 'none' : headerCell.borderRight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                flexWrap: 'wrap',
                position: 'relative',
              }}
            >
              <span className="sc-body" style={{ display: 'inline-flex', alignItems: 'center' }}>
                {col.headerLabel}
                <Chevron />
              </span>
              {onRemoveIntensity ? (
                <button
                  type="button"
                  title={`Remove ${col.headerLabel}`}
                  aria-label={`Remove ${col.headerLabel}`}
                  onClick={() => void onRemoveIntensity(col.pillKey)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontSize: 18,
                    lineHeight: 1,
                    padding: '0 4px',
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {addCol ? (
            <div
              style={{
                ...headerCell,
                borderRight: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 4px',
              }}
            >
              {headerAddSlot}
            </div>
          ) : null}
        </div>
        {Array.from({ length: sets }, (_, i) => i + 1).map((n, idx) => (
          <div key={n} style={{ display: 'grid', gridTemplateColumns, background: 'var(--color-surface)' }}>
            <div
              style={{
                ...cellBase,
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-muted)',
              }}
            >
              {n}
            </div>
            <div style={cellBase}>
              {idx === 0 ? (
                <input
                  type="number"
                  min={1}
                  placeholder="—"
                  value={repsDisplay}
                  onChange={(e) => setRepsDraft(e.target.value)}
                  onBlur={commitReps}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitReps()
                    }
                  }}
                  style={inputStyle}
                  aria-label="Reps (all sets)"
                />
              ) : (
                <span className="sc-body" style={{ color: 'var(--color-text-muted)' }}>
                  {repsVal != null ? String(repsVal) : '—'}
                </span>
              )}
            </div>
            {intensityColumns.map((col, i) => (
              <div
                key={col.pillKey}
                style={{
                  ...cellBase,
                  borderRight: i === intensityColumns.length - 1 && !addCol ? 'none' : cellBase.borderRight,
                }}
              >
                {renderIntensityCell(col, idx)}
              </div>
            ))}
            {addCol ? (
              <div style={{ ...cellBase, borderRight: 'none' }} aria-hidden>
                {' '}
              </div>
            ) : null}
          </div>
        ))}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          marginTop: 12,
        }}
      >
        <button type="button" aria-label="Fewer sets" disabled={sets <= MIN_SETS} onClick={() => bumpSets(-1)} style={{ ...ringBtn, opacity: sets <= MIN_SETS ? 0.35 : 1, cursor: sets <= MIN_SETS ? 'not-allowed' : 'pointer' }}>
          −
        </button>
        <span className="sc-body" style={{ fontWeight: 'var(--font-weight-medium)', minWidth: 40, textAlign: 'center' }}>
          Sets
        </span>
        <button type="button" aria-label="More sets" disabled={sets >= MAX_SETS} onClick={() => bumpSets(1)} style={{ ...ringBtn, opacity: sets >= MAX_SETS ? 0.35 : 1, cursor: sets >= MAX_SETS ? 'not-allowed' : 'pointer' }}>
          +
        </button>
      </div>
    </div>
  )
}
