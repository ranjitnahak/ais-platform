import { useEffect, useState } from 'react'
import { btnOutline, btnPrimary, inp, modalBox, modalOverlay } from '../../lib/programmeSessionUi.js'

export default function CopyWeekModal({ emptyWeeks, busy = false, onClose, onConfirm }) {
  const firstId = emptyWeeks[0]?.id ?? ''
  const [target, setTarget] = useState(firstId)
  useEffect(() => {
    setTarget(emptyWeeks[0]?.id ?? '')
  }, [firstId])
  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2 className="sc-headline" style={{ marginTop: 0 }}>
          Copy week to
        </h2>
        {emptyWeeks.length === 0 ? (
          <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            No empty weeks to copy into.
          </p>
        ) : (
          <select value={target} onChange={(e) => setTarget(e.target.value)} style={inp}>
            {emptyWeeks.map((w) => (
              <option key={w.id} value={w.id}>
                Week {w.week_number}
              </option>
            ))}
          </select>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
          <button type="button" style={btnOutline} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={btnPrimary}
            disabled={!target || emptyWeeks.length === 0 || busy}
            onClick={() => void onConfirm(target)}
          >
            {busy ? 'Copying…' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}
