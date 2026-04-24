import { useState } from 'react'
import { DIFFICULTIES, PHASE_TYPES, TRAINING_AGES } from '../../lib/programmeUi.js'
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

export default function CreateProgrammeModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [sport, setSport] = useState('')
  const [phase_type, setPhase] = useState('general')
  const [training_age, setAge] = useState('intermediate')
  const [difficulty, setDiff] = useState('moderate')
  const [description, setDesc] = useState('')
  const [weeks, setWeeks] = useState(4)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 24,
      }}
      role="dialog"
      aria-modal
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-container)',
        }}
      >
        <h2 className="sc-headline" style={{ marginTop: 0 }}>
          Create programme
        </h2>
        <label className="sc-label-caps" style={{ display: 'block', marginBottom: 8 }}>
          Name *
        </label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <label className="sc-label-caps" style={{ display: 'block', margin: '12px 0 8px' }}>
          Sport
        </label>
        <input value={sport} onChange={(e) => setSport(e.target.value)} style={inputStyle} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <Field label="Phase type">
            <select value={phase_type} onChange={(e) => setPhase(e.target.value)} style={inputStyle}>
              {PHASE_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Training age">
            <select value={training_age} onChange={(e) => setAge(e.target.value)} style={inputStyle}>
              {TRAINING_AGES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Difficulty">
          <select value={difficulty} onChange={(e) => setDiff(e.target.value)} style={inputStyle}>
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
        <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        <label className="sc-label-caps" style={{ display: 'block', margin: '12px 0 8px' }}>
          Number of weeks
        </label>
        <input
          type="number"
          min={1}
          max={52}
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          style={{ ...inputStyle, width: 120 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
          <button type="button" style={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={btnPrimary}
            disabled={!name.trim()}
            onClick={() => onSave({ name, sport, phase_type, training_age, difficulty, description, weeks })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
