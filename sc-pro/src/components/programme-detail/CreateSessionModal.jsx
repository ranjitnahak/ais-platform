import { useState } from 'react'
import { btnOutline, btnPrimary, inp, modalBox, modalOverlay } from '../../lib/programmeSessionUi.js'

export default function CreateSessionModal({ initial, categories, onClose, onSave }) {
  const [name, setName] = useState('')
  const [category, setCat] = useState('strength')
  const [time, setTime] = useState('09:00')
  const [venue, setVenue] = useState('')
  const [dur, setDur] = useState(60)
  const [coach, setCoach] = useState('')
  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2 className="sc-headline" style={{ marginTop: 0 }}>
          Create session
        </h2>
        <label className="sc-label-caps">Name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inp} />
        <label className="sc-label-caps" style={{ marginTop: 12, display: 'block' }}>
          Category
        </label>
        <select value={category} onChange={(e) => setCat(e.target.value)} style={inp}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="sc-label-caps" style={{ marginTop: 12, display: 'block' }}>
          Time
        </label>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inp} />
        <label className="sc-label-caps" style={{ marginTop: 12, display: 'block' }}>
          Venue
        </label>
        <input value={venue} onChange={(e) => setVenue(e.target.value)} style={inp} />
        <label className="sc-label-caps" style={{ marginTop: 12, display: 'block' }}>
          Planned duration (min)
        </label>
        <input type="number" value={dur} onChange={(e) => setDur(Number(e.target.value))} style={inp} />
        <label className="sc-label-caps" style={{ marginTop: 12, display: 'block' }}>
          Coach instructions
        </label>
        <textarea value={coach} onChange={(e) => setCoach(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
          <button type="button" style={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={btnPrimary}
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                name,
                category,
                start_time: `${time}:00`.slice(0, 8),
                venue,
                planned_duration_min: dur,
                coach_instructions: coach,
                session_date: initial.session_date,
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
