import { useEffect, useState } from 'react'
import { useRPELog } from '../hooks/useRPELog'
import { useWellness } from '../hooks/useWellness'

const RPE_LABELS = [
  ['0', 'Rest'],
  ['5', 'Hard'],
  ['7', 'Very Hard'],
  ['10', 'Max'],
]

export default function AthleteHome() {
  const { sessions, loading, submitting, error, submitted, submitRPELog } = useRPELog()
  const wellness = useWellness()
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [rpe, setRpe] = useState(5)
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [loggedRpe, setLoggedRpe] = useState(null)
  const [responses, setResponses] = useState({})

  const selectedSession = sessions.find((session) => session.id === selectedSessionId)
  const readinessScore = wellness.todayLog?.composite_score ?? getCompositeScore(wellness.formItems, responses)

  useEffect(() => {
    setResponses((current) => {
      const next = { ...current }
      wellness.formItems.forEach((item) => {
        if (item.input_type === 'slider' && next[item.key] == null) next[item.key] = midpoint(item)
      })
      return next
    })
  }, [wellness.formItems])

  async function handleSubmit() {
    if (!selectedSessionId || !duration) return
    try {
      await submitRPELog({ sessionId: selectedSessionId, actualRpe: Number(rpe), actualDurationMin: Number(duration), notes })
      setLoggedRpe(Number(rpe))
    } catch (err) {
      console.error('[AthleteHome] submit RPE failed:', err)
    }
  }

  async function handleWellnessSubmit() {
    try {
      await wellness.submitWellness(responses)
    } catch (err) {
      console.error('[AthleteHome] submit wellness failed:', err)
    }
  }

  function updateResponse(key, value) {
    setResponses((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] px-4 py-8 font-['Inter'] text-[var(--color-on-surface)]">
      <main className="mx-auto max-w-[480px] space-y-5">
        <header className="rounded-3xl bg-[var(--color-surface-container)] p-6 shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">AIS Athlete</p>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight">How was your session today?</h1>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Log training load and your morning readiness.</p>
        </header>

        {loading && (
          <div className="flex justify-center rounded-2xl bg-[var(--color-surface-container)] py-12">
            <span className="material-symbols-outlined animate-spin text-4xl text-[var(--color-primary)]">refresh</span>
          </div>
        )}

        {!loading && !sessions.length && (
          <section className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6 text-center">
            <p className="font-bold text-[var(--color-on-surface)]">No sessions scheduled today</p>
            <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Check back after your next scheduled session.</p>
          </section>
        )}

        {error && (
          <div className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface-container)] p-4 text-sm text-[var(--color-error)]">
            {error}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-[var(--color-outline)]">Session RPE</h2>
          {sessions.map((session) => {
            const isSelected = selectedSessionId === session.id
            return (
              <div key={session.id} className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
                <button type="button" onClick={() => setSelectedSessionId(isSelected ? null : session.id)} className="flex min-h-16 w-full items-center justify-between gap-4 text-left">
                  <div>
                    <h3 className="text-lg font-black text-[var(--color-on-surface)]">{session.name}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {session.category && (
                        <span className="rounded-full bg-[var(--color-surface-variant)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                          {session.category}
                        </span>
                      )}
                      {session.planned_rpe != null && (
                        <span className="text-xs font-bold text-[var(--color-outline)]">Planned RPE: {session.planned_rpe}</span>
                      )}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[var(--color-outline)]">{isSelected ? 'expand_less' : 'expand_more'}</span>
                </button>

                {isSelected && (
                  <div className="mt-5 space-y-5 border-t border-[var(--color-outline-variant)] pt-5">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-widest text-[var(--color-outline)]">CR10 RPE</label>
                        <span className="text-3xl font-black text-[var(--color-primary)]">{rpe}</span>
                      </div>
                      <input type="range" min="0" max="10" step="0.5" value={rpe} onChange={(event) => setRpe(event.target.value)} className="h-10 w-full" style={{ accentColor: 'var(--color-primary)' }} />
                      <div className="mt-1 grid grid-cols-4 text-[10px] font-bold text-[var(--color-outline)]">
                        {RPE_LABELS.map(([value, label]) => <span key={value}>{value}={label}</span>)}
                      </div>
                    </div>

                    <input type="number" min="0" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Duration in minutes" className="min-h-12 w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 text-base text-[var(--color-on-surface)] outline-none" />
                    <textarea rows="2" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes (optional)" className="w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-4 text-base text-[var(--color-on-surface)] outline-none" />
                    <button type="button" disabled={submitting || !duration} onClick={handleSubmit} className="min-h-14 w-full rounded-xl bg-[var(--color-primary-container)] text-sm font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50">
                      {submitting ? 'Logging...' : 'Log Session'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </section>

        {submitted && selectedSession && (
          <section className="rounded-2xl bg-[var(--color-tertiary-container)] p-5 text-[var(--color-on-tertiary)]">
            <p className="text-sm font-black uppercase tracking-widest">Session logged ✓</p>
            <p className="mt-2 text-4xl font-black">RPE {loggedRpe}</p>
            <p className="mt-1 text-sm font-bold">{selectedSession.name}</p>
          </section>
        )}

        <section className="space-y-4 rounded-3xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">Daily Check-in</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Morning Wellness</h2>
          </div>

          {wellness.loading && (
            <div className="flex justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-3xl text-[var(--color-primary)]">refresh</span>
            </div>
          )}

          {wellness.error && (
            <div className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-error)]">
              {wellness.error}
            </div>
          )}

          {!wellness.loading && wellness.submitted && (
            <div className="rounded-2xl bg-[var(--color-tertiary-container)] p-5 text-[var(--color-on-tertiary)]">
              <p className="text-sm font-black uppercase tracking-widest">Wellness logged for today ✓</p>
              <p className="mt-2 text-3xl font-black">Readiness Score: {formatScore(readinessScore)} / 5</p>
            </div>
          )}

          {!wellness.loading && !wellness.submitted && (
            <div className="space-y-5">
              {wellness.formItems.map((item) => (
                <WellnessField key={item.id} item={item} value={responses[item.key]} onChange={updateResponse} />
              ))}
              <button type="button" disabled={wellness.submitting} onClick={handleWellnessSubmit} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary-container)] text-sm font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50">
                {wellness.submitting && <span className="material-symbols-outlined animate-spin text-base">refresh</span>}
                {wellness.submitting ? 'Submitting...' : 'Submit Wellness'}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function WellnessField({ item, value, onChange }) {
  const label = item.label
  if (item.input_type === 'slider') {
    const current = value ?? midpoint(item)
    return (
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="text-sm font-black text-[var(--color-on-surface)]">{label}</label>
          <span className="text-3xl font-black text-[var(--color-primary)]">{current}</span>
        </div>
        <input type="range" min={item.scale_min} max={item.scale_max} step="0.5" value={current} onChange={(event) => onChange(item.key, Number(event.target.value))} className="h-10 w-full" style={{ accentColor: 'var(--color-primary)' }} />
        <div className="mt-1 flex justify-between text-[10px] font-bold text-[var(--color-outline)]">
          <span>{item.scale_min_label}</span>
          <span>{item.scale_max_label}</span>
        </div>
      </div>
    )
  }
  if (item.input_type === 'number') {
    return (
      <label className="block text-sm font-black text-[var(--color-on-surface)]">
        {label}
        <input type="number" value={value ?? ''} onChange={(event) => onChange(item.key, Number(event.target.value))} placeholder="Hours" className="mt-2 min-h-12 w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 text-base font-normal text-[var(--color-on-surface)] outline-none" />
      </label>
    )
  }
  if (item.input_type === 'radio') {
    return (
      <div>
        <p className="text-sm font-black text-[var(--color-on-surface)]">{label}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {getOptions(item).map((option) => (
            <button key={option} type="button" onClick={() => onChange(item.key, option)} className={`min-h-11 rounded-xl border px-4 text-xs font-black uppercase tracking-widest ${value === option ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-on-primary)]' : 'border-[var(--color-outline-variant)] bg-[var(--color-surface)] text-[var(--color-on-surface-variant)]'}`}>
              {option}
            </button>
          ))}
        </div>
      </div>
    )
  }
  return (
    <label className="block text-sm font-black text-[var(--color-on-surface)]">
      {label}
      <input type="text" value={value ?? ''} onChange={(event) => onChange(item.key, event.target.value)} placeholder="Describe any areas of soreness" className="mt-2 min-h-12 w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 text-base font-normal text-[var(--color-on-surface)] outline-none" />
    </label>
  )
}

function midpoint(item) {
  return (Number(item.scale_min ?? 0) + Number(item.scale_max ?? 5)) / 2
}

function getOptions(item) {
  if (Array.isArray(item.options)) return item.options
  try {
    return JSON.parse(item.options ?? '[]')
  } catch {
    return []
  }
}

function formatScore(score) {
  const value = Number(score)
  return Number.isNaN(value) ? '—' : value.toFixed(1)
}

function getCompositeScore(items, responses) {
  const values = items.filter((item) => ['slider', 'number'].includes(item.input_type)).map((item) => {
    const value = Number(responses[item.key])
    if (Number.isNaN(value)) return null
    return item.direction === 'lower_better' ? Number(item.scale_max) - value + Number(item.scale_min) : value
  }).filter((value) => value != null)
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
