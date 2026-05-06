import { useEffect, useMemo, useRef, useState } from 'react'
import { useProgressionView } from '../../hooks/useProgressionView.js'

const vars = {
  sets: { key: 'sets', label: 'Sets' },
  Reps: { key: 'reps', label: 'Reps' },
  '%1RM': { key: '%1RM', label: '%1RM' },
  RPE: { key: 'RPE', label: 'RPE' },
  RIR: { key: 'RIR', label: 'RIR' },
  Time: { key: 'Time', label: 'Time (s)' },
  Absolute: { key: 'Absolute', label: 'Absolute' },
  Vel: { key: 'Vel', label: 'Vel' },
  Dist: { key: 'Dist', label: 'Dist' },
  Max: { key: 'Max', label: 'Max' },
  Rest: { key: 'Rest', label: 'Rest' },
}

function fmtCellInput(d) {
  if (d == null) return ''
  const n = Number(d)
  return Number.isFinite(n) ? String(n) : ''
}

function prescriptionValueForType(cell, typeStr) {
  if (!cell || !typeStr) return null
  if (cell.prescriptionType === typeStr) return cell.prescriptionValue ?? null
  if (cell.secondaryPrescriptionType === typeStr) return cell.secondaryPrescriptionValue ?? null
  if (cell.tertiaryPrescriptionType === typeStr) return cell.tertiaryPrescriptionValue ?? null
  return null
}

function cellValueForVar(cell, varKey) {
  if (varKey === 'sets') return cell?.sets
  if (varKey === 'Reps') return cell?.reps
  if (varKey === '%1RM') return prescriptionValueForType(cell, 'pct_1rm')
  if (varKey === 'RPE')
    return cell?.prescriptionType === 'rpe'
      ? cell?.prescriptionValue
      : cell?.secondaryPrescriptionType === 'rpe'
        ? cell?.secondaryPrescriptionValue
        : cell?.tertiaryPrescriptionType === 'rpe'
          ? cell?.tertiaryPrescriptionValue
          : null
  if (varKey === 'RIR')
    return cell?.prescriptionType === 'rir'
      ? cell?.prescriptionValue
      : cell?.secondaryPrescriptionType === 'rir'
        ? cell?.secondaryPrescriptionValue
        : cell?.tertiaryPrescriptionType === 'rir'
          ? cell?.tertiaryPrescriptionValue
          : null
  if (varKey === 'Time') return prescriptionValueForType(cell, 'time')
  if (varKey === 'Absolute') return prescriptionValueForType(cell, 'absolute')
  if (varKey === 'Vel') return prescriptionValueForType(cell, 'velocity')
  if (varKey === 'Dist') return prescriptionValueForType(cell, 'distance')
  if (varKey === 'Max') return prescriptionValueForType(cell, 'max')
  if (varKey === 'Rest') return cell?.restSeconds
  return null
}

function ProgressionCellInput({ displayValue, hasExerciseRow, onSave }) {
  const [text, setText] = useState(() => fmtCellInput(displayValue))
  const focusedRef = useRef(false)
  useEffect(() => {
    if (focusedRef.current) return
    setText(fmtCellInput(displayValue))
  }, [displayValue])
  const commit = (raw) => {
    let s = String(raw).trim().replace(/%/g, '').trim()
    if (s === '') return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  return (
    <input
      type="number"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => {
        focusedRef.current = true
        e.target.style.borderColor = 'var(--color-primary)'
        e.target.style.opacity = 1
      }}
      onBlur={(e) => {
        focusedRef.current = false
        e.target.style.borderColor = 'var(--color-border)'
        if (!hasExerciseRow && text.trim() === '') e.target.style.opacity = 0.5
        onSave(commit(text))
      }}
      style={{
        width: 48,
        fontSize: 14,
        textAlign: 'center',
        background: 'var(--color-surface-high)',
        border: '0.5px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--color-text)',
        padding: '3px 4px',
        outline: 'none',
        opacity: hasExerciseRow ? 1 : 0.5,
      }}
    />
  )
}

export default function ProgressionView({ programmeId, weeks, orgId, defaultSessionName }) {
  const [selectedLabel, setSelectedLabel] = useState('')
  const [saveStatus, setSaveStatus] = useState(null)
  const hasInitialised = useRef(false)
  const activeSessionName = selectedLabel
  const { matrixData, sessionNames, saveCell } = useProgressionView({
    programmeId,
    weeks,
    activeSessionName,
    orgId,
  })

  useEffect(() => {
    if (!sessionNames.length) return
    if (hasInitialised.current) return
    hasInitialised.current = true
    if (defaultSessionName) {
      const match = sessionNames.find((s) => s.name === defaultSessionName)
      if (match) {
        setSelectedLabel(match.label)
        return
      }
    }
    setSelectedLabel(sessionNames[0].label)
  }, [sessionNames, defaultSessionName])

  const sourceSessionId = matrixData.columns.find((c) => c.sessionId)?.sessionId ?? null

  const handleSave = async (exerciseRowId, field, value, creationContext) => {
    setSaveStatus('saving')
    try {
      await saveCell(exerciseRowId, field, value, creationContext)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    }
  }

  const visibleVars = useMemo(
    () => matrixData.visibleVars.filter((v) => Boolean(vars[v])),
    [matrixData.visibleVars],
  )

  const totalColumns = 1 + matrixData.columns.length * Math.max(1, visibleVars.length)

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <label htmlFor="progression-session-name" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
          Session
        </label>
        <select
          id="progression-session-name"
          value={selectedLabel}
          onChange={(e) => setSelectedLabel(e.target.value)}
          style={{
            minWidth: 220,
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-high)',
            color: 'var(--color-text)',
          }}
        >
          {sessionNames.map((option) => (
            <option key={option.label} value={option.label}>
              {option.label}
            </option>
          ))}
        </select>
        {saveStatus === 'saving' && (
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>Saving...</span>
        )}
        {saveStatus === 'saved' && (
          <span style={{ fontSize: 12, color: 'var(--color-success, #22c55e)', marginLeft: 'auto' }}>
            All changes saved
          </span>
        )}
        {saveStatus === 'error' && (
          <span style={{ fontSize: 12, color: 'var(--color-danger)', marginLeft: 'auto' }}>
            Save failed — try again
          </span>
        )}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 860, width: '100%' }}>
          <thead>
            <tr>
              <th
                rowSpan={2}
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  background: 'var(--color-surface)',
                  borderBottom: '1px solid var(--color-border)',
                  padding: '8px 10px',
                  textAlign: 'left',
                  minWidth: 240,
                }}
              >
                Exercise
              </th>
              {matrixData.columns.map((col) => (
                <th
                  key={col.weekId}
                  colSpan={Math.max(1, visibleVars.length)}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    borderLeft: '1px solid var(--color-border)',
                    padding: '8px 0',
                    textAlign: 'center',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                  }}
                >
                  Week {col.weekNumber}
                </th>
              ))}
            </tr>
            <tr>
              {matrixData.columns.map((col) =>
                visibleVars.map((v, idx) => (
                  <th
                    key={`${col.weekId}-${v}`}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      borderLeft: idx === 0 ? '1px solid var(--color-border)' : '0.5px solid var(--color-border)',
                      padding: '6px 8px',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-muted)',
                      background: 'var(--color-surface-high)',
                      minWidth: 64,
                    }}
                  >
                    {vars[v]?.label ?? v}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {matrixData.rows.map((block) => (
              <FragmentBlock
                key={block.blockLabel}
                block={block}
                columns={matrixData.columns}
                visibleVars={visibleVars}
                totalColumns={totalColumns}
                saveCell={handleSave}
                sourceSessionId={sourceSessionId}
                blockLabel={block.blockLabel}
                blockSortOrder={block.blockSortOrder ?? 0}
                teamId={null}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FragmentBlock({
  block,
  columns,
  visibleVars,
  totalColumns,
  saveCell,
  sourceSessionId,
  blockLabel,
  blockSortOrder,
  teamId,
}) {
  return (
    <>
      <tr>
        <td
          colSpan={totalColumns}
          style={{
            background: 'var(--color-surface-high)',
            color: 'var(--color-primary)',
            fontWeight: 'var(--font-weight-semibold)',
            borderTop: '1px solid var(--color-border)',
            padding: '8px 10px',
          }}
        >
          Block {block.blockLabel}
        </td>
      </tr>
      {block.exercises.map((row) => (
        <tr key={`${block.blockLabel}-${row.slotLabel}-${row.exerciseName}`}>
          <td
            style={{
              position: 'sticky',
              left: 0,
              zIndex: 2,
              background: 'var(--color-surface)',
              borderTop: '0.5px solid var(--color-border)',
              padding: '7px 10px',
            }}
          >
            <span style={{ color: 'var(--color-primary)', marginRight: 8 }}>{row.slotLabel}</span>
            <span>{row.exerciseName}</span>
          </td>
          {columns.map((col) =>
            visibleVars.map((v, idx) => {
              const cell = row.cells[col.weekId]
              const value = cellValueForVar(cell, v)
              return (
                <td
                  key={`${row.slotLabel}-${col.weekId}-${v}`}
                  style={{
                    borderTop: '0.5px solid var(--color-border)',
                    borderLeft: idx === 0 ? '1px solid var(--color-border)' : '0.5px solid var(--color-border)',
                    padding: 6,
                    textAlign: 'center',
                  }}
                >
                  <ProgressionCellInput
                    displayValue={value}
                    hasExerciseRow={Boolean(cell?.exerciseRowId)}
                    onSave={(val) => {
                      const creationContext = !cell?.exerciseRowId
                        ? {
                            weekId: col.weekId,
                            sourceSessionId,
                            blockLabel,
                            blockSortOrder,
                            exerciseId: row.exerciseId,
                            exerciseSortOrder: row.exerciseOrder ?? 0,
                            teamId,
                          }
                        : null
                      saveCell(cell?.exerciseRowId ?? null, v, val, creationContext)
                    }}
                  />
                </td>
              )
            }),
          )}
        </tr>
      ))}
    </>
  )
}
