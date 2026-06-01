import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getCurrentUser, canSync } from '../../lib/auth'
import { resolveOrgTeamScope, narrowTeamIds } from '../../lib/orgScope'
import { useUser } from '../../context/UserContext'
import WellnessTrend from './WellnessTrend'
import DashboardSkeleton from '../shared/skeletons/DashboardSkeleton'

const METRIC_COLUMNS = [
  { key: 'fatigue', label: 'Fatigue', inverse: true },
  { key: 'sleep_quality', label: 'Sleep Quality', inverse: false },
  { key: 'sleep_hours', label: 'Sleep Hours', inverse: false },
  { key: 'motivation', label: 'Training Motivation', inverse: false },
  { key: 'performance_satisfaction', label: 'Performance Satisfaction', inverse: false },
  { key: 'soreness', label: 'Soreness', inverse: true },
]

export default function WellnessDashboard({ embedded = false }) {
  const { user, activeOrgId, activeTeamId } = useUser()
  const [athletes, setAthletes] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [wellnessView, setWellnessView] = useState('grid')
  const canView = canSync(user, 'wellness', 'view')

  useEffect(() => {
    if (!canView) return
    async function loadDashboard() {
      try {
        setLoading(true)
        setError(null)
        const currentUser = await getCurrentUser()
        const orgId = activeOrgId ?? currentUser?.orgId
        if (!currentUser || !orgId) return
        const { effectiveTeamIds } = await resolveOrgTeamScope(supabase, currentUser, activeOrgId)
        const teamIds = narrowTeamIds(effectiveTeamIds, activeTeamId)
        if (!teamIds.length) {
          setAthletes([])
          setLogs([])
          return
        }
        const { data: athleteRows, error: athleteError } = await supabase
          .from('athletes')
          .select('id, full_name, photo_url, athlete_teams!inner(team_id)')
          .eq('org_id', orgId)
          .eq('is_active', true)
          .in('athlete_teams.team_id', teamIds)
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
          .eq('org_id', orgId)
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
  }, [canView, activeOrgId, activeTeamId])

  const summary = useMemo(() => {
    const scored = logs.filter((log) => log.composite_score != null)
    const average = scored.length ? scored.reduce((sum, log) => sum + Number(log.composite_score), 0) / scored.length : null
    const flagged = logs.filter((log) => log.flagged || (log.composite_score != null && Number(log.composite_score) < 2.5)).length
    return { submitted: logs.length, total: athletes.length, average, flagged }
  }, [athletes.length, logs])

  if (!canView) {
    return (
      <p className="rounded-2xl bg-[var(--color-surface-container)] p-6 text-sm font-bold text-[var(--color-on-surface-variant)]">
        You do not have permission to view wellness data.
      </p>
    );
  }

  const content = (
      <div className={`mx-auto max-w-6xl space-y-6 ${embedded ? '' : ''}`}>
        {!embedded && (
        <header>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">Team Readiness</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Wellness Dashboard</h1>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Today&apos;s wellness submissions for your assigned teams.</p>
        </header>
        )}

        {!loading && (
          <section className="grid gap-3 rounded-3xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4 sm:grid-cols-3">
            <SummaryTile label="Submitted Today" value={`${summary.submitted} of ${summary.total}`} />
            <SummaryTile label="Average Score" value={summary.average == null ? '—' : summary.average.toFixed(1)} />
            <SummaryTile label="Flagged" value={summary.flagged} />
          </section>
        )}

        {loading && <DashboardSkeleton contentOnly />}

        {error && (
          <div className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface-container)] p-4 text-sm text-[var(--color-error)]">
            {error}
          </div>
        )}

        {!loading && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[var(--color-text-muted)]">
              {summary.submitted} of {summary.total} submitted
            </p>
            <WellnessViewToggle wellnessView={wellnessView} onChange={setWellnessView} />
          </div>
        )}

        {!loading && wellnessView === 'grid' && (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {athletes.map((athlete) => {
              const log = logs.find((entry) => entry.athlete_id === athlete.id)
              return <AthleteCard key={athlete.id} athlete={athlete} log={log} />
            })}
          </section>
        )}

        {!loading && wellnessView === 'table' && (
          <WellnessTable athletes={athletes} logs={logs} />
        )}
      </div>
  );

  if (embedded) return content;

  return (
    <main className="min-h-screen bg-[var(--color-surface)] px-4 py-8 font-['Inter'] text-[var(--color-on-surface)] md:ml-64 md:px-8">
      {content}
    </main>
  );
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
  const sorenessAreas = Array.isArray(log?.responses?.soreness_areas)
    ? log.responses.soreness_areas
    : []
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

      {sorenessAreas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sorenessAreas.map((area) => (
            <span
              key={area}
              className="rounded-full bg-[var(--color-error-container)] px-2 py-0.5 text-[9px] font-bold text-[var(--color-error)]"
            >
              {area}
            </span>
          ))}
        </div>
      )}
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

function athleteInitials(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase()
}

function scorePillBackground(value, { inverse = false } = {}) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (inverse) {
    if (n <= 2) return 'var(--color-excellent)'
    if (n === 3) return 'var(--color-avg)'
    return 'var(--color-below-avg)'
  }
  if (n <= 2) return 'var(--color-below-avg)'
  if (n === 3) return 'var(--color-avg)'
  return 'var(--color-excellent)'
}

function WellnessViewToggle({ wellnessView, onChange }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        aria-label="Grid view"
        aria-pressed={wellnessView === 'grid'}
        onClick={() => onChange('grid')}
        className="flex h-7 w-7 items-center justify-center rounded"
        style={{
          background: wellnessView === 'grid' ? 'var(--color-primary)' : 'transparent',
          color: wellnessView === 'grid' ? 'white' : 'var(--color-text-muted)',
        }}
      >
        <i className="ti ti-layout-grid text-base leading-none" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Table view"
        aria-pressed={wellnessView === 'table'}
        onClick={() => onChange('table')}
        className="flex h-7 w-7 items-center justify-center rounded"
        style={{
          background: wellnessView === 'table' ? 'var(--color-primary)' : 'transparent',
          color: wellnessView === 'table' ? 'white' : 'var(--color-text-muted)',
        }}
      >
        <i className="ti ti-table text-base leading-none" aria-hidden />
      </button>
    </div>
  )
}

function MetricPill({ value, inverse }) {
  const bg = scorePillBackground(value, { inverse })
  if (bg == null) {
    return <span className="text-[var(--color-text-muted)]">—</span>
  }
  return (
    <span
      className="inline-flex min-w-[1.75rem] justify-center rounded-full px-2 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: bg }}
    >
      {value}
    </span>
  )
}

function SoreAreaCell({ areas }) {
  const list = Array.isArray(areas) ? areas.filter(Boolean) : []
  if (!list.length) {
    return <span className="text-[var(--color-text-muted)]">—</span>
  }
  return (
    <span className="inline-block max-w-[10rem] truncate rounded-full bg-[var(--color-error-container)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-error)]">
      {list.join(', ')}
    </span>
  )
}

function WellnessTable({ athletes, logs }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]" style={{ borderBottomWidth: '0.5px' }}>
            <th className="sticky left-0 z-20 min-w-[11rem] bg-[var(--color-surface-container)] px-3 py-2 text-left text-[12px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              Athlete
            </th>
            {METRIC_COLUMNS.map((col) => (
              <th
                key={col.key}
                className="whitespace-nowrap px-3 py-2 text-center text-[12px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]"
              >
                {col.label}
              </th>
            ))}
            <th className="whitespace-nowrap px-3 py-2 text-center text-[12px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              Sore Area
            </th>
          </tr>
        </thead>
        <tbody>
          {athletes.map((athlete) => {
            const log = logs.find((entry) => entry.athlete_id === athlete.id)
            const responses = log?.responses ?? {}
            if (!log) {
              return (
                <tr
                  key={athlete.id}
                  className="opacity-40"
                  style={{ borderBottom: '0.5px solid var(--color-border)', cursor: 'default' }}
                >
                  <td className="sticky left-0 z-10 bg-[var(--color-surface-container)] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface)] text-xs font-black text-[var(--color-on-surface)]">
                        {athleteInitials(athlete.full_name)}
                      </div>
                      <span className="truncate font-bold text-[var(--color-on-surface)]">{athlete.full_name}</span>
                    </div>
                  </td>
                  <td
                    colSpan={METRIC_COLUMNS.length + 1}
                    className="px-3 py-2.5 text-center text-xs font-bold text-[var(--color-text-muted)]"
                  >
                    Not submitted
                  </td>
                </tr>
              )
            }
            return (
              <tr
                key={athlete.id}
                className="hover:bg-[var(--color-surface-hover)]"
                style={{ borderBottom: '0.5px solid var(--color-border)', cursor: 'default' }}
              >
                <td className="sticky left-0 z-10 bg-[var(--color-surface-container)] px-3 py-2.5 hover:bg-[var(--color-surface-hover)]">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface)] text-xs font-black text-[var(--color-on-surface)]">
                      {athleteInitials(athlete.full_name)}
                    </div>
                    <span className="truncate font-bold text-[var(--color-on-surface)]">{athlete.full_name}</span>
                  </div>
                </td>
                {METRIC_COLUMNS.map((col) => (
                  <td key={col.key} className="px-3 py-2.5 text-center">
                    <MetricPill value={responses[col.key]} inverse={col.inverse} />
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center">
                  <SoreAreaCell areas={responses.soreness_areas} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
