import { useState } from 'react'
import { useRPELog } from '../hooks/useRPELog'

const RPE_LABELS = [
  ['0', 'Rest'],
  ['5', 'Hard'],
  ['7', 'Very Hard'],
  ['10', 'Max'],
]

export default function AthleteHome() {
  const { sessions, loading, submitting, error, submitted, submitRPELog } = useRPELog()
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [rpe, setRpe] = useState(5)
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [loggedRpe, setLoggedRpe] = useState(null)

  const selectedSession = sessions.find((session) => session.id === selectedSessionId)

  async function handleSubmit() {
    if (!selectedSessionId || !duration) return
    await submitRPELog({
      sessionId: selectedSessionId,
      actualRpe: Number(rpe),
      actualDurationMin: Number(duration),
      notes,
    })
    setLoggedRpe(Number(rpe))
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] px-4 py-8 font-['Inter'] text-[var(--color-on-surface)]">
      <main className="mx-auto max-w-[480px] space-y-5">
        <header className="rounded-3xl bg-[var(--color-surface-container)] p-6 shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary-container)]">AIS Athlete</p>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight">How was your session today?</h1>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Log your CR10 RPE after training.</p>
        </header>

        {loading && (
          <div className="flex justify-center rounded-2xl bg-[var(--color-surface-container)] py-12">
            <span className="material-symbols-outlined animate-spin text-4xl text-[var(--color-primary-container)]">refresh</span>
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

        <div className="space-y-3">
          {sessions.map((session) => {
            const isSelected = selectedSessionId === session.id
            return (
              <section key={session.id} className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
                <button type="button" onClick={() => setSelectedSessionId(isSelected ? null : session.id)} className="flex min-h-16 w-full items-center justify-between gap-4 text-left">
                  <div>
                    <h2 className="text-lg font-black text-[var(--color-on-surface)]">{session.name}</h2>
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
                        <span className="text-3xl font-black text-[var(--color-primary-container)]">{rpe}</span>
                      </div>
                      <input type="range" min="0" max="10" step="0.5" value={rpe} onChange={(event) => setRpe(event.target.value)} className="h-10 w-full" style={{ accentColor: 'var(--color-primary-container)' }} />
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
              </section>
            )
          })}
        </div>

        {submitted && selectedSession && (
          <section className="rounded-2xl bg-[var(--color-tertiary-container)] p-5 text-[var(--color-on-tertiary)]">
            <p className="text-sm font-black uppercase tracking-widest">Session logged ✓</p>
            <p className="mt-2 text-4xl font-black">RPE {loggedRpe}</p>
            <p className="mt-1 text-sm font-bold">{selectedSession.name}</p>
          </section>
        )}
      </main>
    </div>
  )
}
