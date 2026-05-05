import { createContext, useCallback, useEffect, useState } from 'react'
import { getCurrentUser } from '../../lib/auth.js'
import { buildProgrammePDF } from '../../lib/buildProgrammePDF.js'
import { fetchProgrammesForAthlete } from '../../lib/fetchProgrammesForAthlete.js'

export const AthletePdfExportContext = createContext(null)

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1200,
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

const sel = {
  width: '100%',
  marginTop: 8,
  padding: '10px 12px',
  borderRadius: 'var(--radius-default)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-low)',
  color: 'var(--color-text)',
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

const btnOutline = { ...btnPrimary, background: 'transparent', border: '1px solid var(--color-border)' }

function displayName(a) {
  if (a?.display_name) return a.display_name
  if (a?.full_name) return a.full_name
  if (a?.name) return a.name
  return [a?.first_name, a?.last_name].filter(Boolean).join(' ').trim() || 'Athlete'
}

export default function ProgrammeExportModal({ athlete, onClose }) {
  const user = getCurrentUser()
  const [rows, setRows] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoadingList(true)
    setError('')
    try {
      const list = await fetchProgrammesForAthlete(athlete, user.orgId)
      setRows(list)
      setSelectedId(list[0]?.id ?? '')
    } catch (err) {
      console.error('[ProgrammeExportModal]', err)
      setRows([])
      setSelectedId('')
      setError('Could not load programmes.')
    } finally {
      setLoadingList(false)
    }
  }, [athlete, user.orgId])

  useEffect(() => {
    void load()
  }, [load])

  const selected = rows.find((r) => r.id === selectedId) ?? null
  const teamLine = (athlete.teams || []).map((t) => t.name).join(', ') || '—'

  const onGenerate = async () => {
    if (!selected || generating) return
    setGenerating(true)
    setError('')
    try {
      await buildProgrammePDF(athlete, selected)
      onClose?.()
    } catch (err) {
      console.error('[ProgrammeExportModal] pdf', err)
      setError('PDF generation failed — please try again')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="export-pdf-title" onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h2 id="export-pdf-title" className="sc-headline" style={{ marginTop: 0 }}>
          Export Programme PDF
        </h2>
        <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: '0 0 4px' }}>
          <strong style={{ color: 'var(--color-text)' }}>{displayName(athlete)}</strong>
          <span> · {teamLine}</span>
        </p>

        {error ? (
          <p className="sc-body-sm" role="alert" style={{ color: 'var(--color-danger)', marginTop: 12 }}>
            {error}
          </p>
        ) : null}

        <label className="sc-label-caps" style={{ display: 'block', marginTop: 16 }}>
          Programme
        </label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loadingList || !rows.length || generating}
          style={sel}
        >
          {!rows.length && !loadingList ? <option value="">No programmes assigned</option> : null}
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name || 'Untitled'}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button type="button" style={btnOutline} onClick={onClose} disabled={generating}>
            Cancel
          </button>
          <button
            type="button"
            style={{ ...btnPrimary, opacity: generating || !selected ? 0.6 : 1, cursor: generating ? 'wait' : 'pointer' }}
            onClick={() => void onGenerate()}
            disabled={generating || !selected}
          >
            {generating ? 'Generating…' : 'Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
