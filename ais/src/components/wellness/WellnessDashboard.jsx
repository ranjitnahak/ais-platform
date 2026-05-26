import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getCurrentUser, canSync, useCurrentUser } from '../../lib/auth'
import WellnessTrend from './WellnessTrend'

export default function WellnessDashboard() {
  const { user } = useCurrentUser()
  const [athletes, setAthletes] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const canView = canSync(user, 'wellness', 'view')

  useEffect(() => {
    if (!canView) return
    async function loadDashboard() {
      try {
        setLoading(true)
        setError(null)
        const currentUser = await getCurrentUser()
        if (!currentUser) return
        if (!currentUser.teamIds?.length) {
          setAthletes([])
          setLogs([])
          return
        }
        const { data: athleteRows, error: athleteError } = await supabase
          .from('athletes')
          .select('id, full_name, photo_url, athlete_teams!inner(team_id)')
          .eq('org_id', currentUser.orgId)
          .in('athlete_teams.team_id', currentUser.teamIds)
          .order('full_name', { ascending: true })
        if (athleteError) throw athleteError
        const athleteIds = [...new Set((athleteRows ?? []).map((athlete) => athlete.id))]
        if (!athleteIds.length) {
          setAthletes([])
          setLogs([])
          return
        }
        const today = new Date().toISOString().split('T')[0]
        const { data: logRows, error: logError } = await supabase
          .from('wellness_logs')
          .select('athlete_id, composite_score, flagged, responses, logged_at, athletes(full_name, photo_url)')
          .eq('org_id', currentUser.orgId)
          .eq('log_date', today)
          .in('athlete_id', athleteIds)
          .order('composite_score', { ascending: true })
        if (logError) throw logError
        setAthletes(athleteRows ?? [])
        setLogs(logRows ?? [])
      } catch (err) {
        console.error('[WellnessDashboard] loadDashboard failed:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadDashboard()
  }, [canView])

  const summary = useMemo(() => {
    const scored = logs.filter((log) => log.composite_score != null)
    const average = scored.length ? scored.reduce((sum, log) => sum + Number(log.composite_score), 0) / scored.length : null
    const flagged = logs.filter((log) => log.flagged || (log.composite_score != null && Number(log.composite_score) < 2.5)).length
    return { submitted: logs.length, total: athletes.length, average, flagged }
  }, [athletes.length, logs])

  if (!canView) return null

  return (
    <main className="min-h-screen bg-[var(--color-surface)] px-4 py-8 font-['Inter'] text-[var(--color-on-surface)] md:ml-64 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">Team Readiness</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Wellness Dashboard</h1>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Today&apos;s wellness submissions for your assigned teams.</p>
        </header>

        <section className="grid gap-3 rounded-3xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4 sm:grid-cols-3">
          <SummaryTile label="Submitted Today" value={`${summary.submitted} of ${summary.total}`} />
          <SummaryTile label="Average Score" value={summary.average == null ? '—' : summary.average.toFixed(1)} />
          <SummaryTile label="Flagged" value={summary.flagged} />
        </section>

        {loading && (
          <div className="flex justify-center rounded-3xl bg-[var(--color-surface-container)] py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-[var(--color-primary)]">refresh</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface-container)] p-4 text-sm text-[var(--color-error)]">
            {error}
          </div>
        )}

        {!loading && (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {athletes.map((athlete) => {
              const log = logs.find((entry) => entry.athlete_id === athlete.id)
              return <AthleteCard key={athlete.id} athlete={athlete} log={log} />
            })}
          </section>
        )}
      </div>
    </main>
  )
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-2xl bg-[var(--color-surface)] p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[var(--color-on-surface)]">{value}</p>
    </div>
  )
}

function AthleteCard({ athlete, log }) {
  const score = log?.composite_score == null ? null : Number(log.composite_score)
  const flagged = Boolean(log?.flagged) || (score != null && score < 2.5)
  return (
    <article className={`min-h-48 rounded-3xl border p-4 ${log ? 'border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]' : 'border-[var(--color-outline-variant)] bg-[var(--color-surface-variant)] opacity-70'}`}>
      <div className="flex items-center gap-3">
        {athlete.photo_url ? (
          <img src={athlete.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface)] text-sm font-black text-[var(--color-on-surface)]">
            {(athlete.full_name ?? '?').slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-black">{athlete.full_name}</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]">{log ? 'Submitted' : 'Not submitted'}</p>
        </div>
        {flagged && <span className="material-symbols-outlined text-[var(--color-error)]">flag</span>}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {score == null ? <span className="rounded-full bg-[var(--color-surface)] px-3 py-2 text-xs font-black text-[var(--color-outline)]">Not submitted</span> : <ScoreBadge score={score} />}
        {log && <WellnessTrend athleteId={athlete.id} />}
      </div>
    </article>
  )
}

function ScoreBadge({ score }) {
  const tone = score >= 4
    ? 'bg-[var(--color-tertiary-container)] text-[var(--color-on-tertiary)]'
    : score >= 3
      ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
      : 'bg-[var(--color-error-container)] text-[var(--color-error)]'
  return <span className={`rounded-full px-3 py-2 text-sm font-black ${tone}`}>{score.toFixed(1)}</span>
}
