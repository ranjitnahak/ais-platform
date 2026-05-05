import { useEffect, useState } from 'react'
import { DIFFICULTIES, PHASE_TYPES, TRAINING_AGES } from '../../lib/programmeUi.js'
import { isoLocal, programmeWeekAnchorDate, startOfWeekMonday, weekOneMondayIso } from '../../lib/weekDates.js'
import { btnOutline, btnPrimary } from './programmeLibraryUi.jsx'

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-default)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-low)',
  color: 'var(--color-text)',
}

function Field({ label, children }) {
  return (
    <div>
      <label className="sc-label-caps" style={{ display: 'block', marginBottom: 8 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function effectiveStartDateInput(programme) {
  if (!programme) return ''
  if (programme.start_date != null && String(programme.start_date).trim() !== '') {
    return String(programme.start_date).slice(0, 10)
  }
  return isoLocal(startOfWeekMonday(programmeWeekAnchorDate(programme)))
}

export default function EditProgrammeDetailsModal({ programme, onClose, onSave, busy }) {
  const [name, setName] = useState('')
  const [sport, setSport] = useState('')
  const [phase_type, setPhase] = useState('general')
  const [training_age, setAge] = useState('intermediate')
  const [difficulty, setDiff] = useState('moderate')
  const [description, setDesc] = useState('')
  const [startDate, setStartDate] = useState('')

  useEffect(() => {
    if (!programme) return
    setName(programme.name ?? '')
    setSport(programme.sport ?? '')
    setPhase(programme.phase_type ?? 'general')
    setAge(programme.training_age ?? 'intermediate')
    setDiff(programme.difficulty ?? 'moderate')
    setDesc(programme.description ?? '')
    setStartDate(effectiveStartDateInput(programme))
  }, [programme])

  const week1Before = programme ? weekOneMondayIso(programme) : null
  const week1After = programme
    ? weekOneMondayIso({
        ...programme,
        start_date: startDate || null,
      })
    : null
  const willShiftSessions = week1Before && week1After && week1Before !== week1After

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 120,
        padding: 24,
      }}
      role="dialog"
      aria-modal
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-container)',
        }}
      >
        <h2 className="sc-headline" style={{ marginTop: 0 }}>
          Programme details
        </h2>
        <label className="sc-label-caps" style={{ display: 'block', marginBottom: 8 }}>
          Name *
        </label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} disabled={busy} />
        <label className="sc-label-caps" style={{ display: 'block', margin: '12px 0 8px' }}>
          Sport
        </label>
        <input value={sport} onChange={(e) => setSport(e.target.value)} style={inputStyle} disabled={busy} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <Field label="Phase type">
            <select value={phase_type} onChange={(e) => setPhase(e.target.value)} style={inputStyle} disabled={busy}>
              {PHASE_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Training age">
            <select value={training_age} onChange={(e) => setAge(e.target.value)} style={inputStyle} disabled={busy}>
              {TRAINING_AGES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Difficulty">
          <select value={difficulty} onChange={(e) => setDiff(e.target.value)} style={inputStyle} disabled={busy}>
            {DIFFICULTIES.map((p) => (
              <option key={p} value={p}>
                {p.replace('_', ' ')}
              </option>
            ))}
          </select>
        </Field>
        <label className="sc-label-caps" style={{ display: 'block', margin: '12px 0 8px' }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
          disabled={busy}
        />
        <div style={{ marginTop: 12 }}>
          <Field label="Start date (Week 1 anchor)">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={inputStyle}
              disabled={busy}
            />
            <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
              Week columns use the Monday-start week that contains this date. Changing it moves every session by the
              same number of days so workouts stay on the same weekday within each programme week.
            </p>
            {willShiftSessions ? (
              <p className="sc-body-sm" style={{ color: 'var(--color-primary)', margin: '8px 0 0' }}>
                Week 1 Monday moves from {week1Before} to {week1After}; all session dates will shift accordingly when
                you save.
              </p>
            ) : null}
          </Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
          <button type="button" style={btnOutline} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            style={btnPrimary}
            disabled={!name.trim() || busy}
            onClick={() =>
              onSave({
                name: name.trim(),
                sport: sport.trim(),
                phase_type,
                training_age,
                difficulty,
                description: description.trim(),
                startDate: startDate.trim() || null,
              })
            }
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
