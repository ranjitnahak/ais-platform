import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient.js'
import { getCurrentUser } from '../../lib/auth.js'
import { isoLocal } from '../../lib/weekDates.js'
import MonthCalendar from '../ui/MonthCalendar.jsx'
import { flattenSessionExercises } from '../../lib/sessionPreviewFormat.js'

function sessionListDisplayName(s) {
  const n = (s?.name && String(s.name).trim()) || ''
  if (n) return n
  const c = s?.category
  if (c) return String(c).charAt(0).toUpperCase() + String(c).slice(1)
  return 'Session'
}

function parseSessionDateToView(iso) {
  if (!iso || iso.length < 10) {
    const t = new Date()
    return { y: t.getFullYear(), m0: t.getMonth() }
  }
  const y = Number(iso.slice(0, 4))
  const m0 = Number(iso.slice(5, 7)) - 1
  if (Number.isNaN(y) || Number.isNaN(m0)) {
    const t = new Date()
    return { y: t.getFullYear(), m0: t.getMonth() }
  }
  return { y, m0 }
}

function formatSelectedDateHeading(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function renderPrescriptionSummary(summary, prescriptionType) {
  if (!summary) return null
  if (prescriptionType === 'pct_1rm' && summary.includes('@')) {
    const idx = summary.indexOf('@')
    return (
      <>
        <span style={{ color: 'var(--color-text-muted)' }}>{summary.slice(0, idx).trimEnd()}</span>
        <span style={{ color: 'var(--color-primary)' }}> {summary.slice(idx).trim()}</span>
      </>
    )
  }
  return <span style={{ color: 'var(--color-text-muted)' }}>{summary}</span>
}

export default function SessionBuilderLeft({ session, programmeId }) {
  const user = getCurrentUser()
  const navigate = useNavigate()
  const sessionDateIso = session?.session_date?.slice(0, 10) || ''

  const [viewYM, setViewYM] = useState(() => parseSessionDateToView(sessionDateIso))
  const [selectedDate, setSelectedDate] = useState(sessionDateIso)
  const [monthSessionDates, setMonthSessionDates] = useState(() => new Set())
  const [daySessions, setDaySessions] = useState([])

  const todayIso = isoLocal(new Date())

  useEffect(() => {
    const sIso = session?.session_date?.slice(0, 10)
    if (!sIso) return
    setSelectedDate(sIso)
    setViewYM(parseSessionDateToView(sIso))
  }, [session?.id])

  useEffect(() => {
    if (!session?.team_id) return
    let cancel = false
    const { y, m0 } = viewYM
    const start = new Date(y, m0, 1, 12, 0, 0, 0)
    const end = new Date(y, m0 + 1, 0, 12, 0, 0, 0)
    const startIso = isoLocal(start)
    const endIso = isoLocal(end)
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('id, session_date')
          .eq('org_id', user.orgId)
          .eq('team_id', session.team_id)
          .gte('session_date', startIso)
          .lte('session_date', endIso)
        if (error) throw error
        if (cancel) return
        const next = new Set((data ?? []).map((r) => (r.session_date || '').slice(0, 10)))
        setMonthSessionDates(next)
      } catch (e) {
        console.error('[SessionBuilder] left panel month', e)
        if (!cancel) setMonthSessionDates(new Set())
      }
    })()
    return () => {
      cancel = true
    }
  }, [session?.team_id, user.orgId, viewYM.y, viewYM.m0])

  useEffect(() => {
    if (!session?.team_id || !selectedDate) {
      setDaySessions([])
      return
    }
    let cancel = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select(
            `
            id, name, category, start_time, session_date,
            session_blocks (
              id, label, sort_order,
              session_exercises (
                id, sort_order,
                exercise_library (name),
                prescription_type,
                prescription_value,
                sets, reps
              )
            )
          `,
          )
          .eq('org_id', user.orgId)
          .eq('team_id', session.team_id)
          .eq('session_date', selectedDate)
          .order('start_time', { ascending: true })
        if (error) throw error
        if (!cancel) setDaySessions(data ?? [])
      } catch (e) {
        console.error('[SessionBuilder] left panel day', e)
        if (!cancel) setDaySessions([])
      }
    })()
    return () => {
      cancel = true
    }
  }, [session?.team_id, user.orgId, selectedDate])

  const bumpMonth = (delta) => {
    setViewYM((prev) => {
      const d = new Date(prev.y, prev.m0 + delta, 1, 12, 0, 0, 0)
      return { y: d.getFullYear(), m0: d.getMonth() }
    })
  }

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        flexShrink: 0,
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        padding: 'var(--space-container)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      <MonthCalendar
        viewYear={viewYM.y}
        viewMonth0={viewYM.m0}
        onPrevMonth={() => bumpMonth(-1)}
        onNextMonth={() => bumpMonth(1)}
        sessionDates={monthSessionDates}
        selectedIso={selectedDate}
        todayIso={todayIso}
        onSelectDate={(iso) => setSelectedDate(iso)}
      />

      <div>
        <p className="sc-label-caps" style={{ marginBottom: 8 }}>
          Sessions · {formatSelectedDateHeading(selectedDate)}
        </p>
        {daySessions.length === 0 ? (
          <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            No sessions on this date.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {daySessions.map((s) => {
              const active = s.id === session.id
              const t = (s.start_time || '09:00:00').slice(0, 5)
              const am = Number(t.split(':')[0]) < 12
              const lines = flattenSessionExercises(s)
              return (
                <li key={s.id} style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/programmes/${programmeId}/sessions/${s.id}`)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-default)',
                      border: '1px solid transparent',
                      borderLeft: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                      background: active ? 'var(--color-surface-high)' : 'transparent',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="sc-label-caps" style={{ color: 'var(--color-primary)', marginBottom: 4 }}>
                      {am ? 'AM session' : 'PM session'}
                    </div>
                    <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-body)' }}>
                      {sessionListDisplayName(s)}
                    </div>
                    <div className="sc-body-sm" style={{ color: 'var(--color-text-muted)', marginBottom: lines.length ? 6 : 0 }}>
                      {t}
                    </div>
                    {lines.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {lines.map((line, idx) => (
                          <div
                            key={line.id ?? `${s.id}-${idx}`}
                            style={{
                              fontSize: 'var(--font-size-body-sm)',
                              lineHeight: 1.35,
                              wordBreak: 'break-word',
                            }}
                          >
                            <span style={{ color: 'var(--color-text-muted)', fontWeight: 'var(--font-weight-semibold)' }}>
                              {line.blockLabel}
                            </span>
                            <span style={{ color: 'var(--color-text-muted)' }}> &nbsp;{line.name}&nbsp; </span>
                            {line.summary ? renderPrescriptionSummary(line.summary, line.prescriptionType) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        style={{
          marginTop: 'auto',
          padding: 12,
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--color-border)',
          background: 'transparent',
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
        }}
        onClick={() => window.alert('Add session — use programme week view')}
      >
        + Add New Session
      </button>
    </aside>
  )
}
