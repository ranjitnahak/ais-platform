import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { SESSION_PREVIEW_SELECT } from '../lib/sessionPreviewQuery.js'
import SessionPreviewPanelBody from './programme-detail/SessionPreviewPanelBody.jsx'
import { CAT_SOFT, badgePill, btnPrimary } from '../lib/programmeSessionUi.js'

function formatSessionWhen(s) {
  if (!s?.session_date) return '—'
  const d = typeof s.session_date === 'string' ? s.session_date.slice(0, 10) : String(s.session_date)
  const t = s.start_time ? String(s.start_time).slice(0, 5) : ''
  return t ? `${d} · ${t}` : d
}

export default function SessionPreviewPanel({ sessionId, programmeId, orgId, onClose }) {
  const navigate = useNavigate()
  const [entered, setEntered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [error, setError] = useState(null)

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [sessionId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSession(null)
    try {
      const { data, error: err } = await supabase
        .from('sessions')
        .select(SESSION_PREVIEW_SELECT)
        .eq('id', sessionId)
        .eq('org_id', orgId)
        .single()
      if (err) throw err
      setSession(data)
    } catch (e) {
      console.error('[SessionPreview]', e)
      setError(e.message ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [sessionId, orgId])

  useEffect(() => {
    void load()
  }, [load])

  const cat = session?.category || 'mixed'
  const soft = CAT_SOFT[cat] || CAT_SOFT.mixed
  const goBuilder = () => {
    onClose()
    void navigate(`/programmes/${programmeId}/sessions/${sessionId}`)
  }
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        maxWidth: '100vw',
        zIndex: 340,
        background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        transform: entered ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s ease-out',
        boxShadow: '-8px 0 24px color-mix(in srgb, var(--color-bg) 50%, transparent)',
      }}
      role="complementary"
      aria-label="Session preview">
      <header
        style={{
          flexShrink: 0,
          padding: 'var(--space-container)',
          borderBottom: '1px solid var(--color-border)',
          position: 'relative',
          paddingRight: 48,
        }}
      >
        <button
          type="button"
          aria-label="Close preview"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 36,
            height: 36,
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            fontSize: 22,
            lineHeight: 1,
          }}
        >
          ×
        </button>
        {loading ? (
          <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            Loading…
          </p>
        ) : error ? (
          <p className="sc-body-sm" style={{ color: 'var(--color-danger)', margin: 0 }}>
            {error}
          </p>
        ) : (
          <>
            <h2 className="sc-headline" style={{ margin: '0 0 8px', fontWeight: 'var(--font-weight-bold)' }}>
              {session?.name || 'Session'}
            </h2>
            <span style={{ ...badgePill, ...soft }}>{cat}</span>
            <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: '10px 0 0' }}>
              {formatSessionWhen(session)}
            </p>
          </>
        )}
      </header>
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-container)' }}>
        {!loading && !error && session ? <SessionPreviewPanelBody session={session} /> : null}
      </div>
      <footer style={{ flexShrink: 0, padding: 'var(--space-container)', borderTop: '1px solid var(--color-border)' }}>
        <button
          type="button"
          disabled={loading || !!error || !session}
          style={{ ...btnPrimary, width: '100%' }}
          onClick={() => void goBuilder()}
        >
          Open in Builder →
        </button>
      </footer>
    </div>
  )
}
